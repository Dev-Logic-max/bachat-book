/**
 * Pakistan's provinces and cities.
 *
 * A local dataset rather than an npm package. `country-state-city` and its
 * cousins ship the whole world to get ~450 Pakistani rows, spell several of them
 * inconsistently, and carry no Urdu at all — and this app has a live Urdu locale.
 * Cities do not change, so a versioned file we control beats a dependency.
 *
 * Coverage is every district headquarters plus the larger towns and
 * cantonments — roughly 220 places. Somewhere genuinely missing is handled by
 * the "Other" option on the form, which unlocks free text; that is deliberate,
 * because no list of Pakistani towns is ever complete.
 *
 * `code` values are stable and safe to store. Names are display-only.
 */

export type Province = {
  code: string;
  name: string;
  nameUr: string;
  /** Territories are not provinces; the label matters on official forms. */
  isTerritory?: boolean;
};

export type City = {
  name: string;
  nameUr: string;
  province: string;
};

export const PROVINCES: Province[] = [
  { code: "PB", name: "Punjab", nameUr: "پنجاب" },
  { code: "SD", name: "Sindh", nameUr: "سندھ" },
  { code: "KP", name: "Khyber Pakhtunkhwa", nameUr: "خیبر پختونخوا" },
  { code: "BA", name: "Balochistan", nameUr: "بلوچستان" },
  { code: "IS", name: "Islamabad Capital Territory", nameUr: "اسلام آباد", isTerritory: true },
  { code: "GB", name: "Gilgit-Baltistan", nameUr: "گلگت بلتستان", isTerritory: true },
  { code: "AJ", name: "Azad Jammu & Kashmir", nameUr: "آزاد جموں و کشمیر", isTerritory: true },
];

const c = (name: string, nameUr: string, province: string): City => ({ name, nameUr, province });

export const CITIES: City[] = [
  // ---- Islamabad Capital Territory ----------------------------------------
  c("Islamabad", "اسلام آباد", "IS"),

  // ---- Punjab --------------------------------------------------------------
  c("Lahore", "لاہور", "PB"),
  c("Faisalabad", "فیصل آباد", "PB"),
  c("Rawalpindi", "راولپنڈی", "PB"),
  c("Gujranwala", "گوجرانوالہ", "PB"),
  c("Multan", "ملتان", "PB"),
  c("Sialkot", "سیالکوٹ", "PB"),
  c("Bahawalpur", "بہاولپور", "PB"),
  c("Sargodha", "سرگودھا", "PB"),
  c("Sheikhupura", "شیخوپورہ", "PB"),
  c("Jhang", "جھنگ", "PB"),
  c("Rahim Yar Khan", "رحیم یار خان", "PB"),
  c("Gujrat", "گجرات", "PB"),
  c("Kasur", "قصور", "PB"),
  c("Sahiwal", "ساہیوال", "PB"),
  c("Okara", "اوکاڑہ", "PB"),
  c("Wah Cantt", "واہ کینٹ", "PB"),
  c("Dera Ghazi Khan", "ڈیرہ غازی خان", "PB"),
  c("Muzaffargarh", "مظفرگڑھ", "PB"),
  c("Chiniot", "چنیوٹ", "PB"),
  c("Mandi Bahauddin", "منڈی بہاؤالدین", "PB"),
  c("Jhelum", "جہلم", "PB"),
  c("Khanewal", "خانیوال", "PB"),
  c("Hafizabad", "حافظ آباد", "PB"),
  c("Vehari", "وہاڑی", "PB"),
  c("Bhakkar", "بھکر", "PB"),
  c("Layyah", "لیہ", "PB"),
  c("Lodhran", "لودھراں", "PB"),
  c("Pakpattan", "پاکپتن", "PB"),
  c("Toba Tek Singh", "ٹوبہ ٹیک سنگھ", "PB"),
  c("Narowal", "نارووال", "PB"),
  c("Nankana Sahib", "ننکانہ صاحب", "PB"),
  c("Chakwal", "چکوال", "PB"),
  c("Khushab", "خوشاب", "PB"),
  c("Mianwali", "میانوالی", "PB"),
  c("Attock", "اٹک", "PB"),
  c("Rajanpur", "راجن پور", "PB"),
  c("Bahawalnagar", "بہاولنگر", "PB"),
  c("Sadiqabad", "صادق آباد", "PB"),
  c("Kamalia", "کمالیہ", "PB"),
  c("Gojra", "گوجرہ", "PB"),
  c("Jaranwala", "جڑانوالہ", "PB"),
  c("Daska", "ڈسکہ", "PB"),
  c("Kamoke", "کاموکی", "PB"),
  c("Wazirabad", "وزیرآباد", "PB"),
  c("Chishtian", "چشتیاں", "PB"),
  c("Burewala", "بورے والا", "PB"),
  c("Kot Addu", "کوٹ ادو", "PB"),
  c("Murree", "مری", "PB"),
  c("Talagang", "تلہ گنگ", "PB"),
  c("Ahmadpur East", "احمد پور شرقیہ", "PB"),
  c("Arifwala", "عارف والا", "PB"),
  c("Mianchannu", "میاں چنوں", "PB"),
  c("Taxila", "ٹیکسلا", "PB"),
  c("Hasilpur", "حاصل پور", "PB"),
  c("Shorkot", "شورکوٹ", "PB"),
  c("Kabirwala", "کبیروالا", "PB"),
  c("Pattoki", "پتوکی", "PB"),
  c("Sambrial", "سمبڑیال", "PB"),
  c("Chunian", "چونیاں", "PB"),
  c("Bhalwal", "بھلوال", "PB"),
  c("Pind Dadan Khan", "پنڈ دادن خان", "PB"),
  c("Gujar Khan", "گوجر خان", "PB"),
  c("Kharian", "کھاریاں", "PB"),
  c("Jalalpur Jattan", "جلال پور جٹاں", "PB"),
  c("Hujra Shah Muqeem", "حجرہ شاہ مقیم", "PB"),
  c("Depalpur", "دیپالپور", "PB"),
  c("Fort Abbas", "فورٹ عباس", "PB"),
  c("Haroonabad", "ہارون آباد", "PB"),
  c("Jampur", "جام پور", "PB"),
  c("Alipur", "علی پور", "PB"),
  c("Liaquatpur", "لیاقت پور", "PB"),
  c("Khanpur", "خان پور", "PB"),
  c("Shujaabad", "شجاع آباد", "PB"),
  c("Kahror Pakka", "کہروڑ پکا", "PB"),
  c("Dunyapur", "دنیا پور", "PB"),
  c("Chichawatni", "چیچہ وطنی", "PB"),
  c("Renala Khurd", "رینالہ خورد", "PB"),
  c("Muridke", "مریدکے", "PB"),
  c("Ferozewala", "فیروزوالا", "PB"),
  c("Sarai Alamgir", "سرائے عالمگیر", "PB"),
  c("Dinga", "ڈنگہ", "PB"),
  c("Phalia", "پھالیہ", "PB"),
  c("Malakwal", "ملکوال", "PB"),
  c("Pasrur", "پسرور", "PB"),
  c("Shakargarh", "شکرگڑھ", "PB"),
  c("Kot Radha Kishan", "کوٹ رادھا کشن", "PB"),
  c("Jhelum Cantt", "جہلم کینٹ", "PB"),
  c("Kallar Syedan", "کلر سیداں", "PB"),
  c("Fateh Jang", "فتح جنگ", "PB"),
  c("Hazro", "حضرو", "PB"),
  c("Pindi Gheb", "پنڈی گھیب", "PB"),
  c("Choa Saidan Shah", "چوآ سیدن شاہ", "PB"),
  c("Kalabagh", "کالاباغ", "PB"),
  c("Piplan", "پپلاں", "PB"),
  c("Darya Khan", "دریا خان", "PB"),
  c("Karor Lal Esan", "کروڑ لعل عیسن", "PB"),
  c("Chowk Azam", "چوک اعظم", "PB"),

  // ---- Sindh ---------------------------------------------------------------
  c("Karachi", "کراچی", "SD"),
  c("Hyderabad", "حیدرآباد", "SD"),
  c("Sukkur", "سکھر", "SD"),
  c("Larkana", "لاڑکانہ", "SD"),
  c("Shaheed Benazirabad", "شہید بینظیر آباد", "SD"),
  c("Mirpur Khas", "میرپور خاص", "SD"),
  c("Jacobabad", "جیکب آباد", "SD"),
  c("Shikarpur", "شکارپور", "SD"),
  c("Khairpur", "خیرپور", "SD"),
  c("Dadu", "دادو", "SD"),
  c("Thatta", "ٹھٹھہ", "SD"),
  c("Badin", "بدین", "SD"),
  c("Ghotki", "گھوٹکی", "SD"),
  c("Kashmore", "کشمور", "SD"),
  c("Sanghar", "سانگھڑ", "SD"),
  c("Umerkot", "عمرکوٹ", "SD"),
  c("Tando Allahyar", "ٹنڈو الہ یار", "SD"),
  c("Tando Muhammad Khan", "ٹنڈو محمد خان", "SD"),
  c("Matiari", "مٹیاری", "SD"),
  c("Jamshoro", "جامشورو", "SD"),
  c("Naushahro Feroze", "نوشہرو فیروز", "SD"),
  c("Qambar Shahdadkot", "قمبر شہداد کوٹ", "SD"),
  c("Mithi", "مٹھی", "SD"),
  c("Sujawal", "سجاول", "SD"),
  c("Nawabshah", "نواب شاہ", "SD"),
  c("Rohri", "روہڑی", "SD"),
  c("Kandhkot", "کندھ کوٹ", "SD"),
  c("Moro", "مورو", "SD"),
  c("Tando Adam", "ٹنڈو آدم", "SD"),
  c("Mirpur Mathelo", "میرپور ماتھیلو", "SD"),
  c("Pano Aqil", "پنو عاقل", "SD"),
  c("Sehwan", "سیہون", "SD"),
  c("Kotri", "کوٹری", "SD"),
  c("Hala", "ہالا", "SD"),
  c("Shahdadpur", "شہداد پور", "SD"),
  c("Daharki", "ڈھرکی", "SD"),
  c("Ubauro", "اوباڑو", "SD"),
  c("Ratodero", "رتوڈیرو", "SD"),
  c("Dokri", "ڈوکری", "SD"),
  c("Mehar", "میہڑ", "SD"),
  c("Khipro", "کھپرو", "SD"),
  c("Digri", "ڈگری", "SD"),
  c("Kunri", "کنری", "SD"),
  c("Chachro", "چھاچھرو", "SD"),
  c("Gambat", "گمبٹ", "SD"),
  c("Bhiria", "بھریا", "SD"),
  c("Keamari", "کیماڑی", "SD"),
  c("Malir", "ملیر", "SD"),
  c("Korangi", "کورنگی", "SD"),
  c("Gadap", "گڈاپ", "SD"),

  // ---- Khyber Pakhtunkhwa --------------------------------------------------
  c("Peshawar", "پشاور", "KP"),
  c("Mardan", "مردان", "KP"),
  c("Mingora", "مینگورہ", "KP"),
  c("Abbottabad", "ایبٹ آباد", "KP"),
  c("Kohat", "کوہاٹ", "KP"),
  c("Bannu", "بنوں", "KP"),
  c("Dera Ismail Khan", "ڈیرہ اسماعیل خان", "KP"),
  c("Nowshera", "نوشہرہ", "KP"),
  c("Charsadda", "چارسدہ", "KP"),
  c("Swabi", "صوابی", "KP"),
  c("Mansehra", "مانسہرہ", "KP"),
  c("Haripur", "ہری پور", "KP"),
  c("Batkhela", "بٹ خیلہ", "KP"),
  c("Timergara", "تیمرگرہ", "KP"),
  c("Chitral", "چترال", "KP"),
  c("Hangu", "ہنگو", "KP"),
  c("Karak", "کرک", "KP"),
  c("Lakki Marwat", "لکی مروت", "KP"),
  c("Tank", "ٹانک", "KP"),
  c("Daggar", "ڈگر", "KP"),
  c("Alpuri", "الپوری", "KP"),
  c("Battagram", "بٹگرام", "KP"),
  c("Dir", "دیر", "KP"),
  c("Khar", "خار", "KP"),
  c("Ghalanai", "غلنئی", "KP"),
  c("Jamrud", "جمرود", "KP"),
  c("Parachinar", "پاراچنار", "KP"),
  c("Miranshah", "میران شاہ", "KP"),
  c("Wana", "وانا", "KP"),
  c("Dassu", "داسو", "KP"),
  c("Shangla", "شانگلہ", "KP"),
  c("Buner", "بونیر", "KP"),
  c("Takht-i-Bahi", "تخت بھائی", "KP"),
  c("Risalpur", "رسالپور", "KP"),
  c("Topi", "ٹوپی", "KP"),
  c("Havelian", "ہویلیاں", "KP"),
  c("Balakot", "بالاکوٹ", "KP"),
  c("Kaghan", "کاغان", "KP"),
  c("Naran", "ناران", "KP"),
  c("Saidu Sharif", "سیدو شریف", "KP"),
  c("Kalam", "کالام", "KP"),
  c("Barikot", "بریکوٹ", "KP"),
  c("Pabbi", "پبی", "KP"),
  c("Akora Khattak", "اکوڑہ خٹک", "KP"),
  c("Lachi", "لاچی", "KP"),
  c("Kulachi", "کلاچی", "KP"),
  c("Paharpur", "پہاڑ پور", "KP"),

  // ---- Balochistan ---------------------------------------------------------
  c("Quetta", "کوئٹہ", "BA"),
  c("Turbat", "تربت", "BA"),
  c("Khuzdar", "خضدار", "BA"),
  c("Hub", "حب", "BA"),
  c("Chaman", "چمن", "BA"),
  c("Gwadar", "گوادر", "BA"),
  c("Sibi", "سبی", "BA"),
  c("Zhob", "ژوب", "BA"),
  c("Loralai", "لورالائی", "BA"),
  c("Mastung", "مستونگ", "BA"),
  c("Kalat", "قلات", "BA"),
  c("Nushki", "نوشکی", "BA"),
  c("Pishin", "پشین", "BA"),
  c("Qila Abdullah", "قلعہ عبداللہ", "BA"),
  c("Qila Saifullah", "قلعہ سیف اللہ", "BA"),
  c("Dera Murad Jamali", "ڈیرہ مراد جمالی", "BA"),
  c("Jaffarabad", "جعفرآباد", "BA"),
  c("Jhal Magsi", "جھل مگسی", "BA"),
  c("Dhadar", "ڈھاڈر", "BA"),
  c("Kharan", "خاران", "BA"),
  c("Uthal", "اوتھل", "BA"),
  c("Awaran", "آواران", "BA"),
  c("Panjgur", "پنجگور", "BA"),
  c("Washuk", "واشک", "BA"),
  c("Barkhan", "بارکھان", "BA"),
  c("Musakhel", "موسیٰ خیل", "BA"),
  c("Sherani", "شیرانی", "BA"),
  c("Harnai", "ہرنائی", "BA"),
  c("Ziarat", "زیارت", "BA"),
  c("Duki", "دکی", "BA"),
  c("Kohlu", "کوہلو", "BA"),
  c("Dera Bugti", "ڈیرہ بگٹی", "BA"),
  c("Sohbatpur", "سہبت پور", "BA"),
  c("Dalbandin", "دالبندین", "BA"),
  c("Surab", "سوراب", "BA"),
  c("Usta Muhammad", "اوستہ محمد", "BA"),
  c("Pasni", "پسنی", "BA"),
  c("Ormara", "اورماڑہ", "BA"),
  c("Jiwani", "جیونی", "BA"),
  c("Mach", "مچھ", "BA"),
  c("Bela", "بیلہ", "BA"),

  // ---- Gilgit-Baltistan ----------------------------------------------------
  c("Gilgit", "گلگت", "GB"),
  c("Skardu", "سکردو", "GB"),
  c("Hunza", "ہنزہ", "GB"),
  c("Nagar", "نگر", "GB"),
  c("Gahkuch", "گاہکوچ", "GB"),
  c("Astore", "آستور", "GB"),
  c("Chilas", "چلاس", "GB"),
  c("Khaplu", "کھپلو", "GB"),
  c("Shigar", "شگر", "GB"),
  c("Kharmang", "کھرمنگ", "GB"),
  c("Danyore", "دنیور", "GB"),
  c("Aliabad", "علی آباد", "GB"),

  // ---- Azad Jammu & Kashmir ------------------------------------------------
  c("Muzaffarabad", "مظفرآباد", "AJ"),
  c("Mirpur", "میرپور", "AJ"),
  c("Kotli", "کوٹلی", "AJ"),
  c("Bhimber", "بھمبر", "AJ"),
  c("Rawalakot", "راولاکوٹ", "AJ"),
  c("Bagh", "باغ", "AJ"),
  c("Forward Kahuta", "فارورڈ کہوٹہ", "AJ"),
  c("Palandri", "پلندری", "AJ"),
  c("Athmuqam", "اٹھمقام", "AJ"),
  c("Hattian Bala", "ہٹیاں بالا", "AJ"),
  c("Dadyal", "ڈڈیال", "AJ"),
  c("Khuiratta", "کھوئی رٹہ", "AJ"),
];

/** Cities in one province, alphabetical. */
export function citiesInProvince(provinceCode: string): City[] {
  return CITIES.filter((city) => city.province === provinceCode).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function findProvince(code: string | null | undefined): Province | undefined {
  if (!code) return undefined;
  return PROVINCES.find((p) => p.code === code);
}

/**
 * Which province a stored city name belongs to.
 *
 * Needed because `profiles.city` predates `profiles.province` — existing rows
 * carry a bare city name and nothing else, so the form has to infer the province
 * to preselect it rather than showing someone a blank field they already filled.
 */
export function provinceForCity(cityName: string | null | undefined): string | undefined {
  if (!cityName) return undefined;
  const match = CITIES.find(
    (city) => city.name.toLowerCase() === cityName.trim().toLowerCase(),
  );
  return match?.province;
}

export function isKnownCity(cityName: string | null | undefined): boolean {
  return provinceForCity(cityName) !== undefined;
}
