export interface WidgetConfig {
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  avatarUrl?: string;
  chatTitle: string;
  greeting: string;
  placeholderText: string;
  autoOpenDelay: number;
}

export interface WidgetCustomer {
  id: string; // Internal system UUID
  email: string;
  apiKey: string; // The X-HP-Standalone-Key or Public key
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  conversationsLimit: number;
  allowedDomains: string[];
  widgetConfig: WidgetConfig;
  enabled: boolean;
  isCustomModelEnabled: boolean;
  createdAt: Date | string;
}

export interface UsageLimits {
  currentMonthlyConversations: number;
  maxMonthlyConversations: number;
  rateLimitPerMinute: number;
  overageEnabled: boolean;
}
