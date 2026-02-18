/**
 * API Client for RuneSmith backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface ApiError {
  detail: string;
}

export class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: 'An error occurred',
      }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  // Auth
  async register(username: string, email: string, password: string) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(username: string, password: string) {
    const data = new URLSearchParams();
    data.append('username', username);
    data.append('password', password);

    const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail);
    }

    const result = await response.json();
    this.setToken(result.access_token);
    return result;
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  // Market
  async browseMarket(params: {
    world_tier?: number;
    element?: string;
    sort_by?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params.world_tier) searchParams.set('world_tier', params.world_tier.toString());
    if (params.element) searchParams.set('element', params.element);
    if (params.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());

    return this.request(`/api/market/browse?${searchParams.toString()}`);
  }

  async buySkill(listing_id: number) {
    return this.request('/api/market/buy', {
      method: 'POST',
      body: JSON.stringify({ listing_id }),
    });
  }

  async listSkill(skill_id: string, price: number, currency_type: string = 'points') {
    return this.request('/api/market/list', {
      method: 'POST',
      body: JSON.stringify({ skill_id, price, currency_type }),
    });
  }

  async rateSkill(listing_id: number, rating: number) {
    return this.request('/api/market/rate', {
      method: 'POST',
      body: JSON.stringify({ listing_id, rating }),
    });
  }

  async getMyListings() {
    return this.request('/api/market/my-listings');
  }

  async cancelListing(listing_id: number) {
    return this.request(`/api/market/cancel/${listing_id}`, {
      method: 'DELETE',
    });
  }

  // Skills
  async saveSkill(skill: {
    skill_id: string;
    name: string;
    user_input: string;
    seed: number;
    world_tier: number;
    combat_budget: number;
    combat_budget_max: number;
    vfx_budget: number;
    vfx_budget_base: number;
    vfx_budget_paid: number;
    mechanics: object;
    vfx: object;
    stats: object;
  }) {
    return this.request<{ id: number; skill_id: string }>('/api/skills/save', {
      method: 'POST',
      body: JSON.stringify(skill),
    });
  }

  async getMySkills() {
    return this.request('/api/skills/my');
  }

  async compileSkill(user_input: string, world_tier: number, extra_vfx_budget: number = 0) {
    return this.request('/api/compile', {
      method: 'POST',
      body: JSON.stringify({ user_input, world_tier, extra_vfx_budget }),
    });
  }
}

export const apiClient = new ApiClient();
