"""
LLM service with streaming and function calling (Groq, OpenAI-compatible).

Customised for Imperium Decorating AI voice receptionist.
"""

import os
import json
import asyncio
from typing import Optional, Callable, Awaitable, List, Dict

from openai import AsyncOpenAI

from ..log import ServiceLogger
from ..tools import TOOLS, execute_tool

log = ServiceLogger("LLM")

# ── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Sophie, the AI voice receptionist for Imperium Decorating — a premium painting and decorating company based in London and Surrey, UK. You answer inbound phone calls on behalf of the company so no call is ever missed.

## YOUR PERSONALITY
- Warm, professional, and friendly — like a top-class human receptionist
- Speak naturally and conversationally (responses will be read aloud via text-to-speech)
- Keep responses concise — typically 1-3 sentences per turn
- Never use markdown, bullet points, numbered lists, or symbols like asterisks, hashtags, or dashes
- Spell out numbers naturally ("twenty-five pounds", not "£25")
- If you need to give a list, use natural speech: "We offer interior painting, exterior painting, and wallpaper installation, among many other services."

## ABOUT IMPERIUM DECORATING
Imperium Decorating is a highly-rated painting and decorating company directed by Zamir and Gramoz, who have worked together for over 15 years. The company is known for attention to detail, punctuality, and customer satisfaction.

Website: imperiumdecorating.com
Phone: plus 44 7482 860007
Email: info at imperiumdecorating.com

Services offered:
Interior and exterior residential and commercial painting, wallpaper installation and removal, plastering and repair, spray finishes, furniture hand painting, handrail and balustrade painting, iron gate and railing restoration, drywall repair and texturing, media walls, wall panelling, wood restoration, staining and varnishing, colour consultation, and leak damage repairs.

Areas covered:
London — including Mayfair, Chelsea, Knightsbridge, Bloomsbury, and Shoreditch.
Surrey — covering Elmbridge, Epsom and Ewell, Guildford, Mole Valley, Reigate and Banstead, and Woking.

Pricing: All quotes are free with no obligation. Prices depend on the scope of the project and are provided after an initial site survey.

Guarantee: The company offers a warranty on all completed work.

## YOUR ROLE
1. GREET the caller warmly and introduce yourself as Sophie from Imperium Decorating.
2. LISTEN to their reason for calling and identify one of these call types:
   - New booking / quote request
   - General enquiry about services or pricing
   - Complaint or issue with existing work
   - Other (message for the team)
3. COLLECT the information you need:
   For bookings: full name, phone number, email (optional), property address, type of service needed, and preferred date.
   For leads / quotes: full name, phone number, email (optional), service interest, and any details.
   For complaints: full name, phone number, description of the issue, and details of the original job.
4. USE YOUR TOOLS to:
   - Check calendar availability before suggesting a date
   - Book confirmed appointments (creates a Google Calendar event and emails the team)
   - Capture leads (emails the team with the enquiry details)
   - Report complaints (emails the team with an urgent alert)
5. CONFIRM everything back to the caller before using a booking tool.
6. CLOSE the call warmly, letting the caller know what happens next.

## IMPORTANT RULES
- Always get the caller's name and phone number before using any tool.
- If the caller asks for pricing, explain that you provide free no-obligation quotes after a brief site visit, and offer to book one.
- If a caller is outside London or Surrey, politely explain the service area and offer to take their details in case coverage expands.
- If asked something you don't know, say you'll pass the message to the team and use capture_lead.
- Never promise specific prices on the call — always say a surveyor will confirm the exact quote.
- Keep the conversation natural and do not read out JSON, tool names, or technical terms aloud.
- If the caller is distressed about a complaint, empathise sincerely before proceeding.

## SPECIAL TRIGGER
When you receive the message "[CALL_CONNECTED]", the call has just connected. Deliver your opening greeting immediately — do not wait. Do not acknowledge or repeat the trigger text.

## CALL FLOW EXAMPLE
Opening: "Good day! Thank you for calling Imperium Decorating. My name is Sophie, how can I help you today?"

After identifying a booking need: collect name, phone, service, address, preferred date. Then check availability and offer slots. Confirm and book.

Closing after booking: "Wonderful! I've booked your appointment and you'll receive a confirmation email shortly. Zamir and the team are looking forward to visiting. Is there anything else I can help with?"

Closing after lead: "Perfect, I've passed your details to the team and someone will call you back very soon. Thank you for calling Imperium Decorating — have a lovely day!"
"""

# ── LLM Service ──────────────────────────────────────────────────────────────


class LLMService:
    """
    OpenAI-compatible streaming LLM with function calling.

    Uses Groq (llama-3.3-70b) for fast responses.
    Handles multi-step tool calls within a single conversation turn.
    """

    def __init__(
        self,
        on_token: Callable[[str], Awaitable[None]],
        on_done: Callable[[], Awaitable[None]],
    ):
        self._on_token = on_token
        self._on_done = on_done

        self._client = AsyncOpenAI(
            api_key=os.getenv("GROQ_API_KEY", ""),
            base_url="https://api.groq.com/openai/v1",
        )
        self._task: Optional[asyncio.Task] = None
        self._running = False

        self._history: List[Dict] = []

    @property
    def is_active(self) -> bool:
        return self._running and self._task is not None

    @property
    def history(self) -> List[Dict]:
        return self._history.copy()

    def clear_history(self) -> None:
        self._history = []

    async def start(self, user_message: str) -> None:
        """Start generating a response to the user's message."""
        if self._running:
            await self.cancel()

        self._history.append({"role": "user", "content": user_message})

        self._running = True
        self._task = asyncio.create_task(self._generate())
        log.connected()

    async def cancel(self) -> None:
        """Cancel ongoing generation."""
        self._running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        log.cancelled()

    async def _generate(self) -> None:
        """
        Generate response with tool-call support.

        Loop:
          1. Stream LLM response
          2. If tool calls in response: execute tools, append results, repeat
          3. If text response: stream tokens to caller
        """
        try:
            while self._running:
                messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self._history

                # Request streaming completion with tools
                stream = await self._client.chat.completions.create(
                    model=os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"),
                    messages=messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    stream=True,
                    max_tokens=500,
                    temperature=0.6,
                )

                # Collect streamed response
                assistant_content = ""
                tool_calls_accumulator: Dict[int, Dict] = {}  # index -> tool_call

                async for chunk in stream:
                    if not self._running:
                        break

                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta is None:
                        continue

                    # Accumulate text tokens
                    if delta.content:
                        assistant_content += delta.content
                        await self._on_token(delta.content)

                    # Accumulate tool call chunks
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_calls_accumulator:
                                tool_calls_accumulator[idx] = {
                                    "id": tc.id or "",
                                    "type": "function",
                                    "function": {"name": "", "arguments": ""},
                                }
                            acc = tool_calls_accumulator[idx]
                            if tc.id:
                                acc["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    acc["function"]["name"] += tc.function.name
                                if tc.function.arguments:
                                    acc["function"]["arguments"] += tc.function.arguments

                if not self._running:
                    break

                # ── Process result ────────────────────────────────────
                if tool_calls_accumulator:
                    # Add assistant message with tool calls
                    tool_calls_list = list(tool_calls_accumulator.values())
                    self._history.append(
                        {
                            "role": "assistant",
                            "content": assistant_content or None,
                            "tool_calls": tool_calls_list,
                        }
                    )

                    # Execute each tool call and append results
                    for tc in tool_calls_list:
                        fn_name = tc["function"]["name"]
                        try:
                            fn_args = json.loads(tc["function"]["arguments"] or "{}")
                        except json.JSONDecodeError:
                            fn_args = {}

                        # Run tool in thread pool to avoid blocking event loop
                        tool_result = await asyncio.get_event_loop().run_in_executor(
                            None, execute_tool, fn_name, fn_args
                        )

                        self._history.append(
                            {
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": tool_result,
                            }
                        )

                    # Continue loop to generate the follow-up text response

                else:
                    # Pure text response — done
                    if assistant_content:
                        self._history.append(
                            {"role": "assistant", "content": assistant_content}
                        )
                    if self._running:
                        await self._on_done()
                    break

        except asyncio.CancelledError:
            raise

        except Exception as e:
            log.error("Generation failed", e)
            await self._on_done()

        finally:
            self._running = False
            self._task = None
