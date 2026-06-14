export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "af", name: "Afrikaans", flag: "🇿🇦" },
  { code: "ak", name: "Akan", flag: "🇬🇭" },
  { code: "sq", name: "Albanian", flag: "🇦🇱" },
  { code: "am", name: "Amharic", flag: "🇪🇹" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hy", name: "Armenian", flag: "🇦🇲" },
  { code: "as", name: "Assamese", flag: "🇮🇳" },
  { code: "az", name: "Azerbaijani", flag: "🇦🇿" },
  { code: "eu", name: "Basque", flag: "🇪🇺" },
  { code: "be", name: "Belarusian", flag: "🇧🇾" },
  { code: "bn", name: "Bengali", flag: "🇧🇩" },
  { code: "bs", name: "Bosnian", flag: "🇧🇦" },
  { code: "bg", name: "Bulgarian", flag: "🇧🇬" },
  { code: "my", name: "Burmese", flag: "🇲🇲" },
  { code: "yue", name: "Cantonese", flag: "🇭🇰" },
  { code: "ca", name: "Catalan", flag: "🇪🇺" },
  { code: "ceb", name: "Cebuano", flag: "🇵🇭" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "hr", name: "Croatian", flag: "🇭🇷" },
  { code: "cs", name: "Czech", flag: "🇨🇿" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "et", name: "Estonian", flag: "🇪🇪" },
  { code: "fo", name: "Faroese", flag: "🇫🇴" },
  { code: "fil", name: "Filipino", flag: "🇵🇭" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "gl", name: "Galician", flag: "🇪🇺" },
  { code: "ka", name: "Georgian", flag: "🇬🇪" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "gu", name: "Gujarati", flag: "🇮🇳" },
  { code: "ha", name: "Hausa", flag: "🇳🇬" },
  { code: "iw", name: "Hebrew", flag: "🇮🇱" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺" },
  { code: "is", name: "Icelandic", flag: "🇮🇸" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "ga", name: "Irish", flag: "🇮🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "kn", name: "Kannada", flag: "🇮🇳" },
  { code: "kk", name: "Kazakh", flag: "🇰🇿" },
  { code: "km", name: "Khmer", flag: "🇰🇭" },
  { code: "rw", name: "Kinyarwanda", flag: "🇷🇼" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ku", name: "Kurdish", flag: "🌍" },
  { code: "ky", name: "Kyrgyz", flag: "🇰🇬" },
  { code: "lo", name: "Lao", flag: "🇱🇦" },
  { code: "lv", name: "Latvian", flag: "🇱🇻" },
  { code: "lt", name: "Lithuanian", flag: "🇱🇹" },
  { code: "mk", name: "Macedonian", flag: "🇲🇰" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "ml", name: "Malayalam", flag: "🇮🇳" },
  { code: "mt", name: "Maltese", flag: "🇲🇹" },
  { code: "mi", name: "Maori", flag: "🇳🇿" },
  { code: "mr", name: "Marathi", flag: "🇮🇳" },
  { code: "mn", name: "Mongolian", flag: "🇲🇳" },
  { code: "ne", name: "Nepali", flag: "🇳🇵" },
  { code: "nb", name: "Norwegian", flag: "🇳🇴" },
  { code: "or", name: "Odia", flag: "🇮🇳" },
  { code: "om", name: "Oromo", flag: "🇪🇹" },
  { code: "ps", name: "Pashto", flag: "🇦🇫" },
  { code: "fa", name: "Persian", flag: "🇮🇷" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "pa", name: "Punjabi", flag: "🇮🇳" },
  { code: "qu", name: "Quechua", flag: "🇵🇪" },
  { code: "ro", name: "Romanian", flag: "🇷🇴" },
  { code: "rm", name: "Romansh", flag: "🇨🇭" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "sr", name: "Serbian", flag: "🇷🇸" },
  { code: "sd", name: "Sindhi", flag: "🇵🇰" },
  { code: "si", name: "Sinhala", flag: "🇱🇰" },
  { code: "sk", name: "Slovak", flag: "🇸🇰" },
  { code: "sl", name: "Slovenian", flag: "🇸🇮" },
  { code: "so", name: "Somali", flag: "🇸🇴" },
  { code: "st", name: "Southern Sotho", flag: "🇱🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "sw", name: "Swahili", flag: "🇰🇪" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "tg", name: "Tajik", flag: "🇹🇯" },
  { code: "ta", name: "Tamil", flag: "🇮🇳" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "tn", name: "Tswana", flag: "🇧🇼" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "tk", name: "Turkmen", flag: "🇹🇲" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "ur", name: "Urdu", flag: "🇵🇰" },
  { code: "uz", name: "Uzbek", flag: "🇺🇿" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "cy", name: "Welsh", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "fy", name: "Western Frisian", flag: "🇳🇱" },
  { code: "wo", name: "Wolof", flag: "🇸🇳" },
  { code: "yo", name: "Yoruba", flag: "🇳🇬" },
  { code: "zu", name: "Zulu", flag: "🇿🇦" },
];

export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

export function detectLanguage(text: string, lang1: string, lang2: string): string {
  const clean1 = lang1.split("-")[0].toLowerCase();
  const clean2 = lang2.split("-")[0].toLowerCase();
  
  // Heuristics for non-latin scripts
  const hasCyrillic = /[а-яА-Я]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const hasKorean = /[\uac00-\ud7af\u1100-\u11ff]/.test(text);
  const hasGreek = /[\u0370-\u03FF]/.test(text);
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  
  if (hasCyrillic) return (clean1 === "ru" || clean1 === "uk" || clean1 === "bg" || clean1 === "be" || clean1 === "sr" || clean1 === "mk" || clean1 === "ky" || clean1 === "tg" || clean1 === "mn") ? lang1 : lang2;
  if (hasArabic) return (clean1 === "ar" || clean1 === "fa" || clean1 === "ps" || clean1 === "ur" || clean1 === "sd") ? lang1 : lang2;
  if (hasJapanese) return clean1 === "ja" ? lang1 : lang2;
  if (hasChinese) return (clean1 === "zh" || clean1 === "yue") ? lang1 : lang2;
  if (hasKorean) return clean1 === "ko" ? lang1 : lang2;
  if (hasGreek) return clean1 === "el" ? lang1 : lang2;
  if (hasHebrew) return clean1 === "iw" ? lang1 : lang2;
  
  // Stop words for Latin-based scripts
  const stopWords: Record<string, string[]> = {
    fr: ["le", "la", "les", "un", "une", "des", "et", "est", "oui", "non", "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "pour", "dans", "avec", "bonjour", "merci", "sur", "pas", "de", "que", "qui", "ce", "dans"],
    en: ["the", "a", "an", "and", "is", "are", "yes", "no", "i", "you", "he", "she", "it", "we", "they", "for", "in", "with", "to", "of", "hello", "thanks", "on", "not", "that", "this", "what", "how"],
    es: ["el", "la", "los", "las", "un", "una", "y", "es", "son", "sí", "no", "yo", "tú", "él", "ella", "nosotros", "para", "en", "con", "de", "del", "hola", "gracias", "por", "que", "como", "este", "esta"],
    de: ["der", "die", "das", "ein", "eine", "und", "ist", "sind", "ja", "nein", "ich", "du", "er", "sie", "es", "wir", "für", "in", "mit", "zu", "von", "hallo", "danke", "nicht", "dass", "was", "wie"],
    it: ["il", "la", "i", "gli", "le", "un", "una", "e", "è", "sì", "no", "io", "tu", "lui", "lei", "noi", "per", "in", "con", "di", "del", "ciao", "grazie", "che", "come", "questo", "non"],
    pt: ["o", "a", "os", "as", "um", "uma", "e", "é", "sim", "não", "eu", "tu", "ele", "ela", "nós", "para", "em", "com", "de", "do", "olá", "obrigado", "obrigada", "que", "como", "este", "não"]
  };
  
  const words = text.toLowerCase().split(/\s+/);
  let score1 = 0;
  let score2 = 0;
  
  const words1 = stopWords[clean1] || [];
  const words2 = stopWords[clean2] || [];
  
  for (const w of words) {
    if (words1.includes(w)) score1++;
    if (words2.includes(w)) score2++;
  }
  
  if (score1 > score2) return lang1;
  if (score2 > score1) return lang2;
  
  // Tie-breaker based on specific accents
  const accents1 = getAccentsCount(text, clean1);
  const accents2 = getAccentsCount(text, clean2);
  if (accents1 > accents2) return lang1;
  if (accents2 > accents1) return lang2;
  
  return lang1; // Fallback
}

function getAccentsCount(text: string, lang: string): number {
  if (lang === "fr") return (text.match(/[éèàùçâêîôûëïü]/gi) || []).length;
  if (lang === "es") return (text.match(/[áéíóúñü¿¡]/gi) || []).length;
  if (lang === "de") return (text.match(/[äöüß]/gi) || []).length;
  if (lang === "it") return (text.match(/[àèìòùé]/gi) || []).length;
  if (lang === "pt") return (text.match(/[áéíóúâêôãõçà]/gi) || []).length;
  return 0;
}
