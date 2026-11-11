import { useEffect } from 'react'

/** Sets document.title to "<title> · OfferShield". */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · OfferShield` : 'OfferShield — Campus Trust Desk'
  }, [title])
}
