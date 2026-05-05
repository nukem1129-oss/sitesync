// ============================================================
// SiteSync v2 Types
// ============================================================

export type SectionType =
  | 'hero'
  | 'page-header'
  | 'about'
  | 'services'
  | 'features'
  | 'process'
  | 'team'
  | 'testimonials'
  | 'faq'
  | 'pricing'
  | 'gallery'
  | 'contact'
  | 'custom'

export interface Theme {
  primaryColor: string    // e.g. "#2563eb"
  secondaryColor: string  // e.g. "#1e40af"
  accentColor: string     // e.g. "#f59e0b"
  backgroundColor: string // e.g. "#ffffff"
  textColor: string       // e.g. "#111827"
  fontFamily: string      // e.g. "'Inter', sans-serif"
  headingFont: string     // e.g. "'Poppins', sans-serif"
  borderRadius: string    // e.g. "8px"
    style?: string          // e.g. "modern" | "classic" | "minimal" | "bold"
}

export type ThemeConfig = Theme

// ── Per-section content shapes ────────────────────────────────

export interface HeroContent {
  headline: string
  subheadline: string
  ctaText: string
  ctaLink: string
  backgroundType: 'color' | 'gradient'
  backgroundValue: string
}

export interface PageHeaderContent {
  heading: string
  subheading?: string
  backgroundValue?: string
}

export interface AboutContent {
  heading: string
  body: string
  stats?: Array<{ label: string; value: string }>
}

export interface Feature {
  title: string
  description: string
  icon?: string
}

export interface FeaturesContent {
  heading: string
  subheading?: string
  features: Feature[]
}

export interface ProcessStep {
  number: number
  title: string
  description: string
}

export interface ProcessContent {
  heading: string
  subheading?: string
  steps: ProcessStep[]
}

export interface FAQ {
  question: string
  answer: string
}

export interface FAQContent {
  heading: string
  faqs: FAQ[]
}

export interface PricingTier {
  name: string
  price: string
  description?: string
  features: string[]
  cta: string
  highlighted?: boolean
}

export interface PricingContent {
  heading: string
  subheading?: string
  tiers: PricingTier[]
}

export interface Service {
  title: string
  description: string
  icon?: string
  price?: string
}

export interface ServicesContent {
  heading: string
  subheading?: string
  services: Service[]
}

export interface TeamMember {
  name: string
  role: string
  bio?: string
}

export interface TeamContent {
  heading: string
  members: TeamMember[]
}

export interface Testimonial {
  quote: string
  author: string
  role?: string
  company?: string
  rating?: number
}

export interface TestimonialsContent {
  heading: string
  testimonials: Testimonial[]
}

export type FormFieldType = 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'checkbox' | 'signature'

export interface FormField {
  type: FormFieldType
  name: string
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
}

export interface ContactContent {
  heading: string
  subheading?: string
  email?: string
  phone?: string
  address?: string
  formFields: FormField[]
  submitLabel?: string
}

export interface CustomContent {
  html: string
  description?: string
}

export type SectionContent =
  | HeroContent
  | PageHeaderContent
  | AboutContent
  | FeaturesContent
  | ProcessContent
  | FAQContent
  | PricingContent
  | ServicesContent
  | TeamContent
  | TestimonialsContent
  | ContactContent
  | CustomContent

// ── Database row shapes ───────────────────────────────────────

export interface SectionRow {
  id: string
  page_id: string
  site_id: string
  type: SectionType
  order_index: number
  label: string
  content: Record<string, unknown>
  section_css: string | null
  section_js: string | null
  published: boolean
  created_at?: string
  updated_at?: string
}

export interface PageRow {
  id: string
  site_id: string
  slug: string
  title: string
  nav_label: string | null
  nav_order: number
  is_homepage: boolean
  page_css: string | null
  page_js: string | null
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  published: boolean
}

export interface SiteRow {
  id: string
  owner_id: string
  subdomain: string
  custom_domain: string | null
  name: string
  theme: Theme
  authorized_senders: string[]
  update_email: string | null
  form_recipient_email: string | null
  tier: 'starter' | 'professional' | 'elite'
  status: 'active' | 'suspended' | 'building'
}

// ── Site plan (returned by Claude before section generation) ──

export interface SitePlan {
  theme: Theme
  pages: Array<{
    slug: string
    title: string
    navLabel: string
    isHomepage: boolean
    sections: Array<{ type: SectionType; label: string }>
  }>
}

// ── Section plan (used by planPage for sub-page generation) ────

export interface SectionPlan {
    type: string
    label: string
}


// ── Page plan (returned by planPage for sub-page generation) ──

export type PagePlan = Array<{ type: SectionType; label: string }>
