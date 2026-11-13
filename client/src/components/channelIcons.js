import { Briefcase, Camera, CircleEllipsis, Globe2, Mail, MessageCircle, MessageSquareText, Phone, Send } from 'lucide-react'

/** Generic (non-brand) icons for the channel an offer arrived through. */
export const CHANNEL_ICONS = Object.freeze({
  whatsapp: MessageCircle,
  telegram: Send,
  email: Mail,
  linkedin: Briefcase,
  instagram: Camera,
  job_portal: Globe2,
  sms: MessageSquareText,
  phone_call: Phone,
  other: CircleEllipsis,
})
