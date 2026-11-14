Bchatfine Municipality website - sample design (front-end prototype)

Contents
- index.html : the whole site in one file (HTML, CSS and JavaScript). Open it in any browser.
- images/    : the photos used on the pages.

How it works
- Every menu tab is a <main data-view="..."> block in index.html (home, discover, municipality,
  services, report, news, events, contact). A small script at the bottom shows one view at a time
  based on the URL hash (e.g. index.html#services).
- Filters (places, projects, forms, news) and the forms are plain JavaScript. The forms only show a
  thank-you message: nothing is sent or stored. The Download buttons and the Arabic switch are placeholders.
- Fonts: Cormorant Garamond (headings) and Jost (text), loaded from Google Fonts.
- Colours are CSS variables at the top of the <style> block.

To do for the real site
- Arabic version (right-to-left) as the main language, English second.
- Connect the forms (Report an issue, Contact, Host an event, Newsletter) to a back end or email.
- Add a content management system so the municipality can post news, notices, events and PDFs.
- Replace every [bracketed] placeholder and the sample headlines, events and projects with real content.
- Optimise the photos for the web (resize and compress).
