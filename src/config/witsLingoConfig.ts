/**
 * WITS LINGO — PERMANENT & FIXED CONFIGURATION
 * 
 * Central source of truth for fixed business contact & live class links.
 * Fixed permanently — NOT configurable from Admin Panel.
 */

export const WITS_LINGO_CONFIG = {
  // Fixed permanent WhatsApp Business sender number
  WHATSAPP_BUSINESS_NUMBER: '+91 87912 87575',
  WHATSAPP_BUSINESS_NUMBER_CLEAN: '918791287575',

  // Fixed permanent Google Meet class link
  GOOGLE_MEET_LINK: 'https://meet.google.com/wwu-zohu-yij',

  // Academy Metadata
  ACADEMY_NAME: 'Wits Lingo Academy',
  ACADEMY_TAGLINE: 'A Global Language Platform',
  SUPPORT_EMAIL: 'witslingo@gmail.com',
  WEBSITE_URL: 'https://witslingo.com',
  FALLBACK_START_DATE: '1st of the upcoming month',
  DEFAULT_SCHEDULE_TIME: 'Monday, Wednesday & Friday (7:30 PM - 8:30 PM IST)'
} as const;

export default WITS_LINGO_CONFIG;
