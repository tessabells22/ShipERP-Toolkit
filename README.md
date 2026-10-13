# Carrier Compliance QA Test Data Toolkit

Test data generator for the Carrier Compliance QA team. Static site: plain HTML/CSS/JS, no build step, no backend, no login. Everything runs in the browser.

## What it does

**1. International Addresses.** Generates Ship From / Ship To pairs (plus optional Sold To, Importer, Ultimate Consignee) for any country combination, laid out like the ShipERP address screen. Click any value to copy it. 15 countries with real city / region / postal-code combinations so carrier address validation passes. Phone numbers use ranges reserved for fiction, emails use `example.com/.net/.org`.

**2. Special Characters.** Two ways:
- In the address tab, open *Special characters* to inject characters into chosen fields at the beginning, middle or end (random or every position).
- In the Special Characters tab, paste your own values and get every value × character × position combination, with code point, length, UTF-8 byte count and XML-escaped form.

**3. Handling Units.** N HUs with weights and dimensions in any UoM (LB, KG, G, OZ / IN, CM, MM, M, FT), configurable ranges and decimals, optional mixed LB/IN and KG/CM in the same shipment.

**4. UoM Conversion.** Converts HUs to the web-service UoM with the calculation shown per value, configurable rounding, optional dimensional / billable weight, and a check that flags when "sum of rounded HUs" differs from "rounded total" (a common source of carrier payload defects). Rows can come from tab 3, be typed in, or pasted from Excel.

**Seeds.** Every generated dataset shows a seed. Untick *New seed each run*, enter the seed from a test case, and the exact same data comes back.

## Running locally

Open `index.html` in a browser. That's it.

Tests: `node --test tests/*.test.js`

## Deploying for the team (GitHub Pages)

The workflow in `.github/workflows/pages.yml` runs the tests and publishes the site on every push to `main`.

1. Merge this branch into `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The next push to `main` (or *Actions → Deploy to GitHub Pages → Run workflow*) publishes it at `https://<owner>.github.io/<repo>/`.

GitHub Pages on a **private** repo needs a paid GitHub plan (Pro / Team / Enterprise). On a free account either make the repo public or use one of the alternatives below. Enterprise Cloud can restrict the Pages site to org members.

**Alternatives** (all free, no account needed by viewers):
- **Netlify Drop**: drag the project folder onto https://app.netlify.com/drop.
- **Cloudflare Pages**: connect the repo, no build command, output directory `/`.
- **Internal file share / SharePoint**: zip the folder; users open `index.html` directly.

## Customising

- Colors: CSS variables at the top of `assets/css/styles.css`.
- Countries, cities, streets, phone formats: `assets/js/data.js`. Region codes follow SAP's default T005S values where those are standard; adjust if your system differs.
- Character sets: `CHAR_SETS` in `assets/js/core.js`.
- SAP field-length warnings: `MAX_LEN` in `assets/js/ui.js`.
