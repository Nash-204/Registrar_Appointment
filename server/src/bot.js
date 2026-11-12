const FAQ = [
  {
    k: ['hour', 'open', 'close', 'schedule', 'time'],
    a: 'We are open Monday to Friday, 8:00 AM to 5:00 PM (except holidays).'
  },
  {
    k: ['where', 'location', 'address', 'located', 'find'],
    a: 'Our office is located at the Local Civil Registry Office (LCRO), Ground Floor, Municipal Hall.'
  },
  {
    k: ['appointment', 'book', 'reserve', 'schedule appointment'],
    a: 'You can book online via the Appointment page. Select your civil registry service, fill in your details, and select your preferred date/time slot. A confirmation reference code will be sent to your email.'
  },
  {
    k: ['fee', 'cost', 'price', 'how much', 'pay', 'payment'],
    a: 'Fees depend on the petition/service: Correction of Clerical Error (R.A. 9048): ₱1,000 filing + ₱400 misc (+ ₱500 migrant fee). Change of First Name (R.A. 9048): ₱3,000 filing + ₱400 misc (+ ₱1,000 migrant fee). Correction of Sex/Date of Birth (R.A. 10172): ₱3,000 filing + ₱400 misc (+ ₱1,000 migrant fee). Indigents with a DSWD certificate are exempt from filing fees.'
  },
  {
    k: ['birth', 'birth certificate', 'register birth'],
    a: 'For Birth Certificate requests, bring a valid ID and details (full name, birth date, parents’ names). For Late Registration of Birth, bring COLB/Form 102, PSA Negative Certification, Affidavit of 2 Disinterested Persons, Barangay Residency Cert, National ID, parents’ IDs/COLB, and 2x2 photo (white background).'
  },
  {
    k: ['marriage', 'marriage license', 'wedding', 'marry'],
    a: 'For a Marriage License, bring PSA CENOMAR, PSA Birth Certificate, CTC/Cedula, POPCOM Counseling Cert, Barangay Tree Planting Cert (2 seedlings) + 2 photos, and Parents’ Advice/Consent forms. For Art. 34 Marriage (cohabitation 5+ yrs), bring CENOMAR, Birth Certs, Child Birth Certs (if any), Affidavit of Cohabitation, and Affidavit of 2 Disinterested Persons.'
  },
  {
    k: ['death', 'death certificate', 'register death'],
    a: 'For Death Certificate requests, bring a valid ID. For Late Registration of Death, bring Death Cert/Form 103, PSA Negative Certification of Death, Affidavit of 2 Disinterested Persons, and proof of death (e.g., photo of epitaph).'
  },
  {
    k: ['late', 'late registration', 'delayed'],
    a: 'Late Registration requires PSA Negative Certification, Form 102/103/97, Affidavit of 2 Disinterested Persons, and supporting documents (baptismal, school records, voter cert). Births also require Barangay residency cert, National ID, parents’ identity proofs, and 2x2 photo. Additional affidavits apply for non-marital/foreign parent cases.'
  },
  {
    k: ['correct', 'correction', 'wrong', 'error', 'misspell', 'change name', 'clerical'],
    a: 'Corrections require a petition, PSA copy of the document, and supporting records (baptismal, school records/Form 137, medical records, valid ID, voter cert). For Change of Name (R.A. 9048) or Sex/Date of Birth (R.A. 10172), you also need NBI, PNP, and Employer clearances (or Affidavit of Unemployment) and 2 consecutive weeks of newspaper publication.'
  },
  {
    k: ['supplemental', 'missing details', 'add information'],
    a: 'For a Supplemental Report (to add missing entries in a civil record), submit the PSA document to be supplemented, an Affidavit of Supplemental Report, and 2 supporting documents (e.g., baptismal, school records, voter certification).'
  },
  {
    k: ['acknowledgment', 'paternity', 'ausf', 'father surname', 'unmarried parents'],
    a: 'For acknowledging a non-marital child, submit an Affidavit of Admission of Paternity (AAP) and/or Affidavit to Use the Surname of the Father (AUSF) under R.A. 9255 (for births on/after Aug 3, 1988), or an Affidavit of Acknowledgment (for births before Aug 3, 1988). Foreign parents must provide a valid passport, BI Clearance, or ACR I-Card.'
  },
  {
    k: ['legitimation', 'legitimate'],
    a: 'For Legitimation by subsequent marriage of parents, submit PSA Birth Certificate, PSA Marriage Certificate of parents, PSA CENOMAR of both parents prior to marriage, and Joint Affidavit of Legitimation. For court decrees/judgments, provide a certified photocopy of the Court Decision and Certificate of Finality.'
  },
  {
    k: ['out of town', 'migrant', 'another town', 'different municipality'],
    a: 'If you reside in a different municipality from where your record was registered, you can file a Migrant Petition under R.A. 9048 / R.A. 10172 at the nearest LCRO. Additional migrant processing service fees apply (₱500 for CCE, ₱1,000 for CFN or Sex/DOB correction).'
  },
  {
    k: ['requirement', 'bring', 'document', 'needed'],
    a: 'Basic requirements include a valid government ID and supporting civil records. Detailed requirements vary per service (Late Registration, Correction, Legitimation, Marriage License, etc.). Specify the exact service to get the complete list.'
  },
  {
    k: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
    a: 'Hello! I can assist you with civil registry services, including requirements for Birth, Death, Marriage, Corrections (R.A. 9048/10172), Late Registration, Legitimation, office hours, and booking appointments.'
  },
  {
    k: ['thank', 'thanks', 'thank you'],
    a: 'You are welcome! Let me know if you need any more assistance with civil registry records.'
  }
];
const HANDOFF = /(speak|talk|chat)\s+(to|with)\s+(a\s+)?(human|person|agent|staff|employee)|human|real person|live agent/i;

export const isHandoffRequest = (text) => HANDOFF.test(String(text));

const GREETING = /^\s*(hi|hello|hey|good (morning|afternoon|evening)|kumusta|kamusta|maayong \w+)\b(\s+(po|there|team|everyone|sir|maam|ma'am))?[\s!.,?]*$/i;
const THANKS = /^\s*(thanks?|thank you|salamat|agyamanak)\b[\s\S]{0,30}$/i;
// Greetings and thanks are answered without searching or calling the model.
export function smallTalkReply(text) {
  if (GREETING.test(text)) return 'Hello! Ask me about our services, the documents to bring, office hours or booking an appointment.';
  if (THANKS.test(text)) return 'You are welcome. Is there anything else I can help you with?';
  return null;
}

export function botReply(text) {
  const t = text.toLowerCase();
  if (HANDOFF.test(t)) return { handoff: true, reply: 'I will connect you with a staff member. Please wait here; someone will join this chat shortly.' };
  const hit = FAQ.find((f) => f.k.some((w) => new RegExp('\\b' + w).test(t))); // word start, so "hi" does not match "which"
  if (hit) return { handoff: false, reply: hit.a };
  return { handoff: true, reply: 'I am not sure about that one, so I am passing your question to a staff member. Please wait here; they will reply in this chat.' };
}
