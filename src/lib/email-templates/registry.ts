import type { ComponentType } from 'react'
import { template as salonApproved } from './salon-approved'
import { template as salonRejected } from './salon-rejected'
import { template as signupOtp } from './signup-otp'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'salon-approved': salonApproved,
  'salon-rejected': salonRejected,
}
