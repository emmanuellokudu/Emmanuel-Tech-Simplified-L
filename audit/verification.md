# Production verification

Verified locally against the final minified assets on 3 August 2026.

## Lighthouse

| Profile | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Mobile | 94 | 100 | 100 | 100 |
| Desktop | 96 | 100 | 100 | 100 |

Mobile: FCP 1.9 s, LCP 1.9 s, TBT 0 ms, CLS 0.  
Desktop: FCP 1.0 s, LCP 1.0 s, TBT 0 ms, CLS 0.

Scores are local Lighthouse measurements and can vary with hardware, network and deployment conditions.

## Responsive and interaction checks

- 320, 360, 390, 768, 1024 and 1440 px: document scroll width matched viewport width.
- Mobile menu: opens, updates `aria-expanded`, locks background scroll and closes after selecting a link.
- Contact form: empty submission is blocked, the first invalid field receives focus, and four field-specific errors are announced.
- No real enquiry was submitted.

## Validation and links

- HTML validator: 7 pages checked, 0 errors.
- Internal link audit: 0 missing targets.
- External project checks: Balwa Africa, Black Apron and Panadol Garage returned HTTP 200.
- GitHub returned HTTP 200. LinkedIn returned automated-request status 999; the URL matches the verified profile supplied in the brief.
