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
  id: string;
  email: string;
  apiKey: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  conversationsLimit: number;
  allowedDomains: string[];
  widgetConfig: WidgetConfig;
  enabled: boolean;
  createdAt: Date | string;
}
