# ShipERP QA Toolkit

Test data generator for the Carrier Compliance QA team. Static site: plain HTML/CSS/JS, no build step, no backend, no login. Everything runs in the browser.

## What it does

**1. Addresses.** Generates Ship From / Ship To pairs (plus optional Sold To, Importer, Ultimate Consignee) for any country combination, laid out like the ShipERP address screen. Click any value to copy it. 15 countries with real city / region / postal-code combinations so carrier address validation passes. Phone numbers use ranges reserved for fiction, emails use `example.com/.net/.org`.

The sidebar has collapsible sections, each showing a one-line summary when closed:
- **Shipment lane**: countries, quick lanes, number of test sets.
- **Special characters** (switch on/off): pick characters from a multi-select dropdown, preloaded with the carrier table (/ERPIS/CHARS2) list; type anything not listed. Choose characters per field, together or apart, position (beginning / middle / end), which fields (every field except Customer #) and which partners. Every selected character is used before any repeats; the summary flags any that didn't fit. Exports gain an "Inserted characters" column.
- **Partners & names**: extra partners, name style and prefix, Customer # numbering.
- **Field options**: house number placement and which optional fields to fill.

**2. Handling Units.** Generates N HUs with weights and dimensions in any UoM (LB, KG, G, OZ / IN, CM, MM, M, FT), configurable ranges and decimals, optionally mixing LB/IN and KG/CM in one shipment. The HU table is editable: change values, add rows, or paste from Excel.

With **Convert to web-service UoM** switched on (the default), a second table shows every HU converted to the target UoM with the calculation under each value, configurable decimals and rounding, and optional dimensional / billable weight. Exports include both source and converted values.

**3. Freight Calculator.** Estimates LTL freight class from density, like freightclasscalc.com: enter pieces, length, width, height and weight per line (dimension unit IN, FT, YD, CM, MM, M or a custom unit; weight unit LB, OZ, KG, G, metric tonnes or a custom unit; weight per piece or per line). Shows cubic feet, total weight, density (lb/ft³) and class per line and for the whole shipment, with the calculation under each value. Choose the classic 18-class density chart or the NMFC 13-tier density scale (2025); the matching tier is highlighted in the density chart. HUs can be pulled in from the Handling Units tab. "Copy as image" pastes the calculation into test evidence. Class is estimated from density only; commodities with a fixed NMFC class are not covered.

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
- Character groups in the dropdown: `CHAR_SETS` in `assets/js/core.js` (the first group is preselected).
- SAP field-length warnings: `MAX_LEN` in `assets/js/ui.js`.
