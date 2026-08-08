# Content still needed from Emmanuel

- An approved professional portrait. The current portrait asset belongs to the Panadol Garage testimonial author and is used only there.
- An approved CV file before enabling a CV download.
- Emmanuel's approval before promising a specific response time.
- KUA attendance records, training dates, curriculum details and approved participant feedback to substantiate the existing “60+ youth trained” record.
- Nice Fashion's final deliverables, design tools and an approved client testimonial.
- Confirmed technology stacks for each public project.
- Analytics or client-approved outcome data for the website projects.
- EmailJS Service ID, Template ID and Public Key in `assets/emailjs-config.js` before the contact form can deliver enquiries.

The enquiry form uses EmailJS, includes a honeypot and accessible client-side validation, and redirects to `thank-you.html` only after EmailJS returns a successful response. The EmailJS template should accept `from_name`, `reply_to`, `service`, `budget`, `message`, `submitted_at`, and `page_url`. Do not test with real personal data without authorization.
