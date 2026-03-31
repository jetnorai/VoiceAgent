import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface HotelSearchParams {
  checkin: string;       // YYYY-MM-DD
  checkout: string;      // YYYY-MM-DD
  adults: number;
  children?: number[];   // ages
  currency?: string;
  countryCode?: string;
  cityName?: string;
  hotelIds?: string[];
  guestNationality?: string;
  limit?: number;
  offset?: number;
}

export interface RatesParams extends HotelSearchParams {
  hotelId: string;
}

export interface PreBookParams {
  rateId: string;
  usePaymentSdk?: boolean;
}

export interface BookParams {
  prebookId: string;
  guestInfo: {
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    guestPhone?: string;
  };
  payment: {
    holderName: string;
    number?: string;
    expireDate?: string;
    cvc?: string;
    type: string;
  };
  clientReference: string;
  remarks?: string;
}

export interface CancelBookingParams {
  bookingId: string;
}

class LiteAPIClient {
  private client: AxiosInstance;

  constructor() {
    const API_KEY = process.env.LITEAPI_KEY;
    if (!API_KEY) throw new Error('LITEAPI_KEY not configured');

    const BASE_URL = process.env.LITEAPI_BASE_URL || (
      process.env.NODE_ENV !== 'production'
        ? 'https://sandbox.liteapi.travel/v3.0'
        : 'https://api.liteapi.travel/v3.0'
    );

    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  private get http(): AxiosInstance {
    return this.client;
  }

  // ─── Hotel data ────────────────────────────────────────────────────────────

  async getHotel(hotelId: string): Promise<any> {
    try {
      const res = await this.http.get(`/data/hotel`, { params: { hotelId } });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI getHotel error', { hotelId, error: err.message });
      throw err;
    }
  }

  async getHotels(params: {
    cityName?: string;
    countryCode?: string;
    hotelName?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    try {
      const res = await this.http.get('/data/hotels', { params });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI getHotels error', { params, error: err.message });
      throw err;
    }
  }

  async getHotelReviews(hotelId: string, limit = 20): Promise<any> {
    try {
      const res = await this.http.get('/data/reviews', { params: { hotelId, limit } });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI getHotelReviews error', { hotelId, error: err.message });
      throw err;
    }
  }

  async getCountries(): Promise<any> {
    const res = await this.http.get('/data/countries');
    return res.data;
  }

  async getCities(countryCode: string): Promise<any> {
    const res = await this.http.get('/data/cities', { params: { countryCode } });
    return res.data;
  }

  // ─── Search & rates ────────────────────────────────────────────────────────

  async searchHotels(params: HotelSearchParams): Promise<any> {
    try {
      const res = await this.http.get('/hotels', {
        params: {
          checkin: params.checkin,
          checkout: params.checkout,
          adults: params.adults,
          children: params.children?.join(','),
          currency: params.currency || 'USD',
          countryCode: params.countryCode,
          cityName: params.cityName,
          guestNationality: params.guestNationality || 'US',
          limit: params.limit || 20,
          offset: params.offset || 0,
        },
      });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI searchHotels error', { params, error: err.message });
      throw err;
    }
  }

  async getHotelRates(params: RatesParams): Promise<any> {
    try {
      const res = await this.http.get('/rates', {
        params: {
          hotelId: params.hotelId,
          checkin: params.checkin,
          checkout: params.checkout,
          adults: params.adults,
          children: params.children?.join(','),
          currency: params.currency || 'USD',
          guestNationality: params.guestNationality || 'US',
        },
      });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI getHotelRates error', { params, error: err.message });
      throw err;
    }
  }

  async getPriceIndex(params: {
    hotelIds: string[];
    checkin: string;
    checkout: string;
    currency?: string;
  }): Promise<any> {
    try {
      const res = await this.http.post('/hotels/price-index', params);
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI getPriceIndex error', { error: err.message });
      throw err;
    }
  }

  // ─── Booking ───────────────────────────────────────────────────────────────

  async preBook(params: PreBookParams): Promise<any> {
    try {
      const res = await this.http.post('/rates/prebook', params);
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI preBook error', { error: err.message });
      throw err;
    }
  }

  async book(params: BookParams): Promise<any> {
    try {
      const res = await this.http.post('/rates/book', params);
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI book error', { error: err.message });
      throw err;
    }
  }

  async getBooking(bookingId: string): Promise<any> {
    try {
      const res = await this.http.get(`/bookings/${bookingId}`);
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI getBooking error', { bookingId, error: err.message });
      throw err;
    }
  }

  async cancelBooking(bookingId: string): Promise<any> {
    try {
      const res = await this.http.put(`/bookings/${bookingId}`, { status: 'CANCELLED' });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI cancelBooking error', { bookingId, error: err.message });
      throw err;
    }
  }

  // ─── Semantic search (LiteAPI AI) ──────────────────────────────────────────

  async semanticSearch(params: {
    query: string;
    checkin: string;
    checkout: string;
    adults: number;
    currency?: string;
    limit?: number;
  }): Promise<any> {
    try {
      const res = await this.http.get('/data/hotels/semantic', {
        params: {
          ...params,
          currency: params.currency || 'USD',
          limit: params.limit || 15,
        },
      });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI semanticSearch error', { query: params.query, error: err.message });
      // Fallback to regular search on semantic failure
      return null;
    }
  }

  async getHotelQA(hotelId: string, question: string): Promise<any> {
    try {
      const res = await this.http.get('/data/hotel/qa', { params: { hotelId, question } });
      return res.data;
    } catch (err: any) {
      logger.error('LiteAPI getHotelQA error', { hotelId, error: err.message });
      return null;
    }
  }
}

export const liteapi = new LiteAPIClient();
