/* Reference data for address generation.
 *
 * Cities use real city / region / postal-code combinations so carrier
 * address validation passes. Phone templates use ranges reserved for
 * fiction where one exists (NANP 555-01xx, UK Ofcom 7946 0xxx / 496 0xxx,
 * AU 5550 xxxx); '#' is replaced with a random digit.
 * Emails use RFC 2606 reserved domains (example.com/.net/.org) so a test
 * run can never mail a real person.
 *
 * Region codes follow SAP's default T005S values where those are standard
 * (US, CA, MX, AU, DE, ES, IT, BR, JP). Your system's configuration may differ.
 *
 * City row: [city, region, postcode, phoneTemplate, suburbs?, streets?]
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.SEData = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAMES = {
    en: {
      first: ['James', 'Olivia', 'Michael', 'Emma', 'Robert', 'Ava', 'David', 'Sophia', 'William', 'Mia', 'Daniel', 'Grace', 'Thomas', 'Chloe', 'Ryan', 'Hannah'],
      last: ['Smith', 'Johnson', 'Brown', 'Taylor', 'Miller', 'Wilson', 'Anderson', 'Clark', 'Walker', 'Young', 'Harris', 'Lewis', 'Hall', 'Wright', "O'Brien", 'Scott']
    },
    es: {
      first: ['José', 'María', 'Juan', 'Guadalupe', 'Luis', 'Sofía', 'Carlos', 'Fernanda', 'Miguel', 'Valeria', 'Jorge', 'Ximena', 'Alejandro', 'Lucía'],
      last: ['Hernández', 'García', 'Martínez', 'López', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz']
    },
    de: {
      first: ['Lukas', 'Anna', 'Jonas', 'Lena', 'Felix', 'Marie', 'Maximilian', 'Sophie', 'Jürgen', 'Katharina', 'Stefan', 'Sabine'],
      last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schäfer', 'Koch', 'Bauer', 'Köhler']
    },
    fr: {
      first: ['Jean', 'Camille', 'Louis', 'Chloé', 'Hugo', 'Léa', 'Mathieu', 'Élodie', 'Nicolas', 'Inès', 'François', 'Amélie'],
      last: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Lefèvre', 'Moreau', 'Laurent', 'Girard']
    },
    nl: {
      first: ['Daan', 'Emma', 'Sem', 'Julia', 'Lucas', 'Sophie', 'Bram', 'Tess', 'Jeroen', 'Femke'],
      last: ['de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer']
    },
    it: {
      first: ['Marco', 'Giulia', 'Alessandro', 'Francesca', 'Lorenzo', 'Chiara', 'Matteo', 'Sara', 'Davide', 'Elena'],
      last: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', "D'Angelo"]
    },
    ja: {
      first: ['Haruto', 'Yui', 'Sota', 'Hina', 'Ren', 'Aoi', 'Takumi', 'Sakura', 'Kenji', 'Yuki'],
      last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato']
    },
    zh: {
      first: ['Wei', 'Fang', 'Lei', 'Jing', 'Hao', 'Min', 'Jun', 'Li', 'Yang', 'Xin'],
      last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou']
    },
    pt: {
      first: ['João', 'Ana', 'Pedro', 'Beatriz', 'Lucas', 'Mariana', 'Gabriel', 'Larissa', 'Rafael', 'Camila'],
      last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Araújo']
    },
    hi: {
      first: ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Kavya', 'Arjun', 'Neha', 'Rahul', 'Sneha'],
      last: ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Iyer', 'Nair', 'Mehta', 'Joshi']
    }
  };

  var COMPANY_PREFIX = ['Northwind', 'Bluewater', 'Summit', 'Pinecrest', 'Ironbridge', 'Redwood', 'Silverline', 'Harbor', 'Atlas', 'Keystone', 'Meridian', 'Crescent', 'Granite', 'Horizon', 'Lakeside', 'Evergreen'];
  var COMPANY_NOUN = ['Logistics', 'Freight', 'Supply', 'Distribution', 'Manufacturing', 'Trading', 'Industries', 'Imports', 'Components', 'Electronics', 'Packaging', 'Foods'];
  var DEPARTMENTS = ['Receiving Dept', 'Shipping Dept', 'Warehouse Manager', 'Logistics Coordinator', 'Accounts Payable', 'Dock Supervisor'];
  var ADDR_EXTRA = ['Dock Door 4', 'Gate 2', 'Loading Bay 3', 'Rear Entrance', 'Receiving Door 7', 'North Building'];
  var EMAIL_DOMAINS = ['example.com', 'example.net', 'example.org'];
  // Used only when a test needs Suburb filled in a country without suburb data
  var GENERIC_SUBURBS = ['Downtown', 'Industrial Park', 'Northside', 'Westgate', 'Harbourfront'];

  var C = {};

  C.US = {
    name: 'United States', locale: 'en', numberFirst: true, houseNum: [100, 9999],
    suffixes: ['LLC', 'Inc.', 'Corp.', 'Co.'],
    streets: ['Main St', 'Oak Ave', 'Industrial Pkwy', 'Commerce Dr', 'Airport Plaza Drive', 'Market St', 'Harbor Blvd', 'Logistics Way', 'Warehouse Rd', 'Distribution Ct', 'Maple Ave', 'Washington Blvd', 'Lincoln Hwy', 'Cargo Rd'],
    addr2: ['Suite 230', 'Suite 100', 'Unit 5', 'Building B', 'Floor 3', 'Dock 12', 'Ste 410'],
    cities: [
      ['Excello', 'MO', '65247', '+1 660 555 01##'],
      ['Chicago', 'IL', '60601', '+1 312 555 01##'],
      ['Los Angeles', 'CA', '90012', '+1 213 555 01##'],
      ['Houston', 'TX', '77002', '+1 713 555 01##'],
      ['Atlanta', 'GA', '30303', '+1 404 555 01##'],
      ['Seattle', 'WA', '98101', '+1 206 555 01##'],
      ['Miami', 'FL', '33130', '+1 305 555 01##'],
      ['Denver', 'CO', '80202', '+1 303 555 01##'],
      ['Memphis', 'TN', '38103', '+1 901 555 01##'],
      ['Louisville', 'KY', '40202', '+1 502 555 01##'],
      ['Newark', 'NJ', '07102', '+1 973 555 01##'],
      ['Boston', 'MA', '02108', '+1 617 555 01##'],
      ['Laredo', 'TX', '78040', '+1 956 555 01##'],
      ['Detroit', 'MI', '48226', '+1 313 555 01##'],
      ['Buffalo', 'NY', '14202', '+1 716 555 01##'],
      ['Phoenix', 'AZ', '85004', '+1 602 555 01##'],
      ['Salt Lake City', 'UT', '84101', '+1 801 555 01##'],
      ['Anchorage', 'AK', '99501', '+1 907 555 01##'],
      ['Honolulu', 'HI', '96813', '+1 808 555 01##']
    ]
  };

  C.CA = {
    name: 'Canada', locale: 'en', numberFirst: true, houseNum: [10, 2999],
    suffixes: ['Ltd.', 'Inc.', 'Corp.', 'Ltée'],
    streets: ['Bay St', 'King St W', 'Front St', 'Granville St', 'Portage Ave', 'Jasper Ave', 'Industrial Rd', 'Rue Sainte-Catherine', 'Rue Saint-Jacques', 'Water St'],
    addr2: ['Suite 1200', 'Unit 7', 'Bureau 300', 'Floor 2', 'Bay 4'],
    cities: [
      ['Toronto', 'ON', 'M5V 2T6', '+1 416 555 01##'],
      ['Vancouver', 'BC', 'V6B 1A1', '+1 604 555 01##'],
      ['Montréal', 'QC', 'H3B 2Y5', '+1 514 555 01##'],
      ['Calgary', 'AB', 'T2P 1J9', '+1 403 555 01##'],
      ['Winnipeg', 'MB', 'R3C 0V8', '+1 204 555 01##'],
      ['Halifax', 'NS', 'B3J 1S9', '+1 902 555 01##'],
      ['Ottawa', 'ON', 'K1P 1J1', '+1 613 555 01##'],
      ['Edmonton', 'AB', 'T5J 0N3', '+1 780 555 01##'],
      ['Québec', 'QC', 'G1R 4S9', '+1 418 555 01##'],
      ['Mississauga', 'ON', 'L5B 3C2', '+1 905 555 01##'],
      ['Windsor', 'ON', 'N9A 1B2', '+1 519 555 01##'],
      ['Regina', 'SK', 'S4P 3Y2', '+1 306 555 01##'],
      ["St. John's", 'NL', 'A1C 1G6', '+1 709 555 01##']
    ]
  };

  C.MX = {
    name: 'Mexico', locale: 'es', numberFirst: false, houseNum: [1, 4999],
    suffixes: ['S.A. de C.V.', 'S. de R.L. de C.V.', 'S.A.P.I. de C.V.'],
    streets: ['Av. Constitución', 'Calle Hidalgo', 'Blvd. Morelos', 'Av. Benito Juárez', 'Calle Zaragoza', 'Av. Revolución', 'Blvd. Industrial', 'Calle Allende', 'Av. Insurgentes', 'Calle Guerrero'],
    addr2: ['Int. 4', 'Bodega 7', 'Nave 2', 'Piso 3', 'Local B'],
    suburbs: ['Col. Centro', 'Col. Industrial', 'Parque Industrial del Norte', 'Col. Del Valle', 'Col. Las Fuentes'],
    cities: [
      ['Reynosa', 'TMS', '88500', '+52 899 ### ####'],
      ['Monterrey', 'NL', '64000', '+52 81 #### ####'],
      ['Guadalajara', 'JAL', '44100', '+52 33 #### ####'],
      ['Ciudad de México', 'DF', '06000', '+52 55 #### ####'],
      ['Tijuana', 'BC', '22000', '+52 664 ### ####'],
      ['Ciudad Juárez', 'CHI', '32000', '+52 656 ### ####'],
      ['Nuevo Laredo', 'TMS', '88000', '+52 867 ### ####'],
      ['Querétaro', 'QRO', '76000', '+52 442 ### ####'],
      ['Puebla', 'PUE', '72000', '+52 222 ### ####'],
      ['Mérida', 'YUC', '97000', '+52 999 ### ####'],
      ['León', 'GTO', '37000', '+52 477 ### ####'],
      ['Saltillo', 'COA', '25000', '+52 844 ### ####'],
      ['Matamoros', 'TMS', '87300', '+52 868 ### ####'],
      ['Hermosillo', 'SON', '83000', '+52 662 ### ####'],
      ['San Luis Potosí', 'SLP', '78000', '+52 444 ### ####']
    ]
  };

  C.GB = {
    name: 'United Kingdom', locale: 'en', numberFirst: true, houseNum: [1, 250],
    suffixes: ['Ltd', 'PLC', 'Limited'],
    streets: ['High Street', 'Station Road', 'Church Lane', 'Victoria Road', 'Mill Lane', "King's Road", 'Park Avenue', 'Queen Street', 'Wharf Road'],
    addr2: ['Unit 4', 'Suite 2', 'Building C', 'Flat 3', 'Floor 1'],
    cities: [
      ['London', '', 'EC1A 1BB', '+44 20 7946 0###'],
      ['Manchester', '', 'M1 1AE', '+44 161 496 0###'],
      ['Birmingham', '', 'B1 1BB', '+44 121 496 0###'],
      ['Leeds', '', 'LS1 4DY', '+44 113 496 0###'],
      ['Glasgow', '', 'G1 1XQ', '+44 141 496 0###'],
      ['Liverpool', '', 'L1 8JQ', '+44 151 496 0###'],
      ['Bristol', '', 'BS1 4DJ', '+44 117 496 0###'],
      ['Edinburgh', '', 'EH1 1YZ', '+44 131 496 0###'],
      ['Cardiff', '', 'CF10 1EP', '+44 29 2018 0###'],
      ['Belfast', '', 'BT1 5GS', '+44 28 9018 0###']
    ]
  };

  C.DE = {
    name: 'Germany', locale: 'de', numberFirst: false, houseNum: [1, 180],
    suffixes: ['GmbH', 'AG', 'GmbH & Co. KG', 'KG'],
    streets: ['Hauptstraße', 'Bahnhofstraße', 'Schillerstraße', 'Goethestraße', 'Industriestraße', 'Lindenstraße', 'Gartenweg', 'Am Hafen', 'Lagerstraße'],
    addr2: ['Gebäude B', 'Halle 3', '2. OG', 'Tor 5', 'Hinterhaus'],
    cities: [
      ['Berlin', '11', '10115', '+49 30 #######'],
      ['Hamburg', '02', '20095', '+49 40 #######'],
      ['München', '09', '80331', '+49 89 #######'],
      ['Köln', '05', '50667', '+49 221 #######'],
      ['Frankfurt am Main', '06', '60311', '+49 69 #######'],
      ['Stuttgart', '08', '70173', '+49 711 #######'],
      ['Düsseldorf', '05', '40213', '+49 211 #######'],
      ['Leipzig', '14', '04109', '+49 341 #######'],
      ['Dresden', '14', '01067', '+49 351 #######'],
      ['Bremen', '04', '28195', '+49 421 #######'],
      ['Hannover', '03', '30159', '+49 511 #######'],
      ['Nürnberg', '09', '90402', '+49 911 #######']
    ]
  };

  C.FR = {
    name: 'France', locale: 'fr', numberFirst: true, houseNum: [1, 150],
    suffixes: ['SAS', 'SARL', 'SA'],
    streets: ['Rue de la République', 'Boulevard Haussmann', 'Avenue Victor Hugo', 'Rue du Faubourg Saint-Honoré', "Quai de l'Industrie", 'Allée des Tilleuls', 'Rue Jean Jaurès', 'Avenue de la Gare'],
    addr2: ['Bâtiment C', 'Étage 2', 'Porte 4', 'Entrepôt 3', 'Lot 12'],
    cities: [
      ['Paris', '', '75001', '+33 1 ## ## ## ##'],
      ['Lyon', '', '69002', '+33 4 ## ## ## ##'],
      ['Marseille', '', '13001', '+33 4 ## ## ## ##'],
      ['Toulouse', '', '31000', '+33 5 ## ## ## ##'],
      ['Nice', '', '06000', '+33 4 ## ## ## ##'],
      ['Lille', '', '59000', '+33 3 ## ## ## ##'],
      ['Bordeaux', '', '33000', '+33 5 ## ## ## ##'],
      ['Strasbourg', '', '67000', '+33 3 ## ## ## ##'],
      ['Nantes', '', '44000', '+33 2 ## ## ## ##'],
      ['Le Havre', '', '76600', '+33 2 ## ## ## ##']
    ]
  };

  C.NL = {
    name: 'Netherlands', locale: 'nl', numberFirst: false, houseNum: [1, 300],
    suffixes: ['B.V.', 'N.V.'],
    streets: ['Damrak', 'Coolsingel', 'Kalverstraat', 'Stationsplein', 'Havenweg', 'Industrieweg', 'Kerkstraat', 'Molenweg'],
    addr2: ['Unit 3', 'Hal 2', 'Verdieping 4', 'Dock 6'],
    cities: [
      ['Amsterdam', '', '1012 JS', '+31 20 ### ####'],
      ['Rotterdam', '', '3011 AD', '+31 10 ### ####'],
      ["'s-Gravenhage", '', '2511 CV', '+31 70 ### ####'],
      ['Utrecht', '', '3511 AX', '+31 30 ### ####'],
      ['Eindhoven', '', '5611 AZ', '+31 40 ### ####'],
      ['Schiphol', '', '1118 CP', '+31 20 ### ####'],
      ['Venlo', '', '5911 AA', '+31 77 ### ####']
    ]
  };

  C.IT = {
    name: 'Italy', locale: 'it', numberFirst: false, houseNum: [1, 220],
    suffixes: ['S.r.l.', 'S.p.A.'],
    streets: ['Via Roma', 'Via Garibaldi', 'Corso Vittorio Emanuele II', "Via dell'Industria", 'Viale Monza', 'Via Milano', 'Via Mazzini', 'Piazza della Repubblica'],
    addr2: ['Scala B', 'Piano 2', 'Interno 5', 'Capannone 3'],
    cities: [
      ['Milano', 'MI', '20121', '+39 02 #### ####'],
      ['Roma', 'RM', '00184', '+39 06 #### ####'],
      ['Napoli', 'NA', '80133', '+39 081 ### ####'],
      ['Torino', 'TO', '10121', '+39 011 ### ####'],
      ['Bologna', 'BO', '40121', '+39 051 ### ####'],
      ['Firenze', 'FI', '50123', '+39 055 ### ####'],
      ['Genova', 'GE', '16121', '+39 010 ### ####'],
      ['Verona', 'VR', '37121', '+39 045 ### ####'],
      ['Venezia', 'VE', '30121', '+39 041 ### ####']
    ]
  };

  C.ES = {
    name: 'Spain', locale: 'es', numberFirst: false, houseNum: [1, 200],
    suffixes: ['S.L.', 'S.A.', 'S.L.U.'],
    streets: ['Calle Mayor', 'Gran Vía', 'Avenida de la Constitución', 'Paseo de la Castellana', 'Calle de Alcalá', 'Carrer de Balmes', 'Calle Real', 'Avenida de Andalucía'],
    addr2: ['Planta 2', 'Nave 3', 'Puerta B', 'Local 4', 'Oficina 12'],
    cities: [
      ['Madrid', '28', '28013', '+34 91 ### ## ##'],
      ['Barcelona', '08', '08002', '+34 93 ### ## ##'],
      ['Valencia', '46', '46002', '+34 96 ### ## ##'],
      ['Sevilla', '41', '41001', '+34 95 ### ## ##'],
      ['Zaragoza', '50', '50001', '+34 976 ## ## ##'],
      ['Bilbao', '48', '48001', '+34 94 ### ## ##'],
      ['Málaga', '29', '29015', '+34 95 ### ## ##'],
      ['A Coruña', '15', '15001', '+34 981 ## ## ##'],
      ['Alicante', '03', '03001', '+34 965 ## ## ##']
    ]
  };

  C.JP = {
    name: 'Japan', locale: 'ja', numberFirst: true, houseNum: 'jp',
    suffixes: ['K.K.', 'Co., Ltd.', 'Corporation'],
    addr2: ['5F', '12F', 'Building A', 'Room 301'],
    cities: [
      ['Tokyo', '13', '100-0005', '+81 3 ####-####', ['Chiyoda-ku'], ['Marunouchi']],
      ['Tokyo', '13', '105-0011', '+81 3 ####-####', ['Minato-ku'], ['Shibakoen']],
      ['Osaka', '27', '530-0001', '+81 6 ####-####', ['Kita-ku'], ['Umeda']],
      ['Yokohama', '14', '220-0012', '+81 45 ###-####', ['Nishi-ku'], ['Minatomirai']],
      ['Nagoya', '23', '450-0002', '+81 52 ###-####', ['Nakamura-ku'], ['Meieki']],
      ['Fukuoka', '40', '812-0011', '+81 92 ###-####', ['Hakata-ku'], ['Hakataekimae']],
      ['Sapporo', '01', '060-0005', '+81 11 ###-####', ['Chuo-ku'], ['Kita 5-jo Nishi']],
      ['Kobe', '28', '650-0021', '+81 78 ###-####', ['Chuo-ku'], ['Sannomiyacho']]
    ]
  };

  C.CN = {
    name: 'China', locale: 'zh', numberFirst: true, houseNum: [1, 2000],
    suffixes: ['Co., Ltd.', 'Trading Co., Ltd.', 'Industrial Co., Ltd.'],
    addr2: ['Room 1801', 'Floor 12', 'Building 3', 'Unit 502'],
    cities: [
      ['Shanghai', '', '200120', '+86 21 #### ####', ['Pudong New Area'], ['Century Avenue', 'Lujiazui Ring Road']],
      ['Beijing', '', '100020', '+86 10 #### ####', ['Chaoyang District'], ['Jianguo Road', 'Guanghua Road']],
      ['Shenzhen', '', '518048', '+86 755 #### ####', ['Futian District'], ['Shennan Boulevard', 'Fuhua Road']],
      ['Guangzhou', '', '510623', '+86 20 #### ####', ['Tianhe District'], ['Huangpu Avenue West', 'Zhujiang East Road']],
      ['Suzhou', '', '215021', '+86 512 #### ####', ['Suzhou Industrial Park'], ['Xinghu Street', 'Suhong Road']],
      ['Ningbo', '', '315040', '+86 574 #### ####', ['Yinzhou District'], ['Siming Road', 'Zhongshan East Road']],
      ['Xiamen', '', '361008', '+86 592 ### ####', ['Siming District'], ['Lianhua Road', 'Hubin South Road']]
    ]
  };

  C.AU = {
    name: 'Australia', locale: 'en', numberFirst: true, houseNum: [1, 600],
    suffixes: ['Pty Ltd', 'Ltd'],
    addr2: ['Level 12', 'Unit 3', 'Suite 5', 'Shed 2'],
    cities: [
      ['Sydney', 'NSW', '2000', '+61 2 5550 ####', [], ['George St', 'Pitt St', 'Botany Rd']],
      ['Melbourne', 'VIC', '3000', '+61 3 5550 ####', [], ['Collins St', 'Bourke St', 'Flinders Ln']],
      ['Brisbane', 'QLD', '4000', '+61 7 5550 ####', [], ['Queen St', 'Adelaide St', 'Eagle St']],
      ['Perth', 'WA', '6000', '+61 8 5550 ####', [], ["St Georges Tce", 'Hay St', 'Murray St']],
      ['Adelaide', 'SA', '5000', '+61 8 5550 ####', [], ['King William St', 'Grenfell St']],
      ['Hobart', 'TAS', '7000', '+61 3 5550 ####', [], ['Elizabeth St', 'Macquarie St']],
      ['Darwin', 'NT', '0800', '+61 8 5550 ####', [], ['Mitchell St', 'Smith St']],
      ['Canberra', 'ACT', '2601', '+61 2 5550 ####', [], ['Northbourne Ave', 'London Cct']]
    ]
  };

  C.BR = {
    name: 'Brazil', locale: 'pt', numberFirst: false, houseNum: [10, 3000],
    suffixes: ['Ltda.', 'S.A.', 'EIRELI'],
    addr2: ['Sala 1203', 'Bloco B', 'Conjunto 42', 'Galpão 3', 'Andar 8'],
    cities: [
      ['São Paulo', 'SP', '01310-100', '+55 11 9####-####', ['Bela Vista'], ['Avenida Paulista']],
      ['Rio de Janeiro', 'RJ', '20040-002', '+55 21 9####-####', ['Centro'], ['Rua da Assembleia', 'Avenida Rio Branco']],
      ['Belo Horizonte', 'MG', '30130-010', '+55 31 9####-####', ['Centro'], ['Avenida Afonso Pena']],
      ['Curitiba', 'PR', '80010-000', '+55 41 9####-####', ['Centro'], ['Rua XV de Novembro']],
      ['Porto Alegre', 'RS', '90010-000', '+55 51 9####-####', ['Centro Histórico'], ['Rua dos Andradas']],
      ['Campinas', 'SP', '13010-001', '+55 19 9####-####', ['Centro'], ['Rua Barão de Jaguara']],
      ['Manaus', 'AM', '69005-000', '+55 92 9####-####', ['Centro'], ['Avenida Eduardo Ribeiro']],
      ['Recife', 'PE', '50010-000', '+55 81 9####-####', ['Santo Antônio'], ['Rua do Imperador']]
    ]
  };

  C.IN = {
    name: 'India', locale: 'hi', numberFirst: true, houseNum: [1, 400],
    suffixes: ['Pvt. Ltd.', 'Ltd.', 'LLP'],
    addr2: ['Floor 4', 'Plot 17', 'Unit 205', 'Tower B', 'Godown 3'],
    cities: [
      ['Mumbai', 'MH', '400001', '+91 22 #### ####', ['Fort'], ['Shahid Bhagat Singh Road', 'Dadabhai Naoroji Road']],
      ['New Delhi', 'DL', '110001', '+91 11 #### ####', ['Connaught Place'], ['Barakhamba Road', 'Janpath']],
      ['Bengaluru', 'KA', '560001', '+91 80 #### ####', ['Shivajinagar'], ['MG Road', 'Brigade Road']],
      ['Chennai', 'TN', '600002', '+91 44 #### ####', ['Mount Road'], ['Anna Salai']],
      ['Hyderabad', 'TG', '500001', '+91 40 #### ####', ['Abids'], ['Abids Road']],
      ['Kolkata', 'WB', '700016', '+91 33 #### ####', ['Park Street'], ['Park Street', 'Camac Street']],
      ['Pune', 'MH', '411004', '+91 20 #### ####', ['Deccan Gymkhana'], ['FC Road', 'JM Road']]
    ]
  };

  C.SG = {
    name: 'Singapore', locale: 'en', numberFirst: true, houseNum: [1, 200],
    suffixes: ['Pte. Ltd.', 'Pte Ltd'],
    addr2: ['#12-01', '#05-22', '#03-10', 'Level 8'],
    cities: [
      ['Singapore', '', '018956', '+65 6### ####', [], ['Marina Boulevard']],
      ['Singapore', '', '048619', '+65 6### ####', [], ['Raffles Place']],
      ['Singapore', '', '238859', '+65 6### ####', [], ['Orchard Road']],
      ['Singapore', '', '819663', '+65 6### ####', [], ['Airport Boulevard']],
      ['Singapore', '', '486030', '+65 6### ####', [], ['Changi South Avenue 2']],
      ['Singapore', '', '609601', '+65 6### ####', [], ['Jurong East Street 21']]
    ]
  };

  // Quick-pick lanes shown as chips in the UI
  var LANES = [
    ['US', 'CA'], ['US', 'MX'], ['CA', 'US'], ['MX', 'US'], ['US', 'GB'],
    ['DE', 'US'], ['CN', 'US'], ['US', 'JP'], ['MX', 'CA'], ['GB', 'DE']
  ];

  return {
    NAMES: NAMES, COMPANY_PREFIX: COMPANY_PREFIX, COMPANY_NOUN: COMPANY_NOUN,
    DEPARTMENTS: DEPARTMENTS, ADDR_EXTRA: ADDR_EXTRA, EMAIL_DOMAINS: EMAIL_DOMAINS, GENERIC_SUBURBS: GENERIC_SUBURBS,
    COUNTRIES: C, LANES: LANES
  };
});
