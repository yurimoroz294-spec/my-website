import { LandingHero } from '@/components/landing/hero'
import { LandingFeatures } from '@/components/landing/features'
import { LandingIntegrations } from '@/components/landing/integrations'
import { LandingPricing } from '@/components/landing/pricing'
import { LandingTestimonials } from '@/components/landing/testimonials'
import { LandingFaq } from '@/components/landing/faq'
import { LandingFooter } from '@/components/landing/footer'
import { LandingNav } from '@/components/landing/nav'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />
      <LandingHero />
      <LandingIntegrations />
      <LandingFeatures />
      <LandingPricing />
      <LandingTestimonials />
      <LandingFaq />
      <LandingFooter />
    </div>
  )
}
