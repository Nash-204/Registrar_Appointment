-- Migration 005: a detailed description for every service (shown on the About Us page and read by the chatbot).
-- Run once after 004. Safe to run again: it never overwrites a description you have already written or edited.
-- These descriptions are plain-language starting text. Please have your registrar review and edit them in
-- Admin > Services and documents.
USE civil_registry;

DROP PROCEDURE IF EXISTS add_service_details;
DELIMITER $$
CREATE PROCEDURE add_service_details()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = 'details') THEN
    ALTER TABLE services ADD COLUMN details TEXT NULL;
  END IF;
END$$
DELIMITER ;
CALL add_service_details();
DROP PROCEDURE add_service_details;

SET SQL_SAFE_UPDATES = 0;

UPDATE services SET details = 'Birth registration records a child’s birth in the civil registry. It is done by filing a Certificate of Live Birth, which is filled out and signed by the doctor, midwife or hospital that attended the birth, together with the details of the parent or informant filing it.

A registered birth record is the basis for the birth certificate, which is needed for school enrollment, a passport, government IDs and many other transactions. Births should normally be registered within 30 days. If it has been longer, choose Late Registration instead.' WHERE purpose = 'Register of Birth' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Death registration records that a person has died. It is done by filing a Certificate of Death, completed and signed by the attending physician or health officer, together with the details of the person filing it.

The death record is needed to settle matters such as insurance, pensions, bank accounts and property. Deaths should normally be registered within 30 days. If it has been longer, choose Late Registration instead. Please ask our staff about burial permits.' WHERE purpose = 'Register of Death' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Marriage registration records a marriage in the civil registry. After the ceremony, the marriage certificate, signed by the couple, the person who solemnized the marriage and the witnesses, is filed with the civil registry of the place where the marriage took place. This should normally be done within 15 days of the ceremony.

The registered marriage record proves that the marriage is on file and is needed for name changes, spousal benefits, visas and other transactions. Applying for a marriage license is a separate process, so please ask our staff about it.' WHERE purpose = 'Register of Marriage' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this when something in a registered birth record is wrong, such as a misspelled name, a typing mistake in the day or month of birth or in the sex, or a first name you want to change. Many clerical or typographical errors, and changes of first name or nickname, can be corrected through a petition to the civil registrar without going to court (Republic Act 9048, as amended by Republic Act 10172).

Bigger changes, such as to the year of birth, nationality or civil status, generally need a court order. Our staff will help you prepare the petition and tell you which supporting documents are needed. A visit takes longer than most because the petition is prepared with you.' WHERE purpose = 'Correction of Birth' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this when a registered death record contains a clerical or typographical error, such as a misspelled name or a detail that was typed in wrongly. Like errors in birth records, many of these can be fixed through a petition to the civil registrar without going to court.

Bring the record that contains the error and documents that show the correct information. Our staff will help you prepare the petition and tell you what else is needed.' WHERE purpose = 'Correction of Death' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this when a registered marriage record contains a clerical or typographical error, such as a misspelled name or a detail that was typed in wrongly. Many of these errors can be fixed through a petition to the civil registrar without going to court.

Bring the record that contains the error and documents that show the correct information, such as birth certificates or IDs. Bigger changes, such as to civil status, generally need a court order. Our staff will advise you.' WHERE purpose = 'Correction of Marriage' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this to get a certified copy of a birth record that is already registered. A certified copy is an official copy of the record on file, used for school, work, passport applications and many other requirements.

The person named on the record, or an immediate family member, can usually request it. Anyone else needs an authorization letter and a copy of the owner’s ID. If you are not sure the birth was ever registered, our staff can check. If it was never registered, you may need Late Registration.' WHERE purpose = 'Request of Birth' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this to get a certified copy of a death record that is already registered. It is an official copy of the record on file, often needed for insurance, pension, bank and property matters.

An immediate family member or a person with a proper reason can usually request it, and anyone requesting for someone else should bring an authorization letter or proof of relationship. If you are not sure the death was ever registered, our staff can check. If it was never registered, you may need Late Registration.' WHERE purpose = 'Request of Death' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this to get a certified copy of a marriage record that is already registered. It is an official copy of the record on file, used for name changes, spousal benefits, visas and other requirements.

One of the spouses can usually request it. Anyone else needs an authorization letter and a copy of a spouse’s ID. If you are not sure the marriage was ever registered, our staff can check. If it was never registered, you may need Late Registration.' WHERE purpose = 'Request of Marriage' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this when a birth, death or marriage was never registered, or was registered after the required period (normally 30 days for births and deaths, and 15 days for marriages). You will typically need to show that the event is not yet on file, explain in a sworn statement why it was not registered on time, and provide records that prove it happened, such as baptismal, school or medical records.

Late registrations are checked more closely than on-time ones. Adults are usually asked to appear in person. Bring as many supporting records as you have; our staff will tell you what else is needed.' WHERE purpose = 'Late Registration' AND (details IS NULL OR details = '');

UPDATE services SET details = 'A supplemental report adds information that was left out of a record that is already registered, for example a missing middle name, the father’s details, or a given name that was left blank. It adds what is missing; it does not change what is already written.

If something in the record is wrong rather than missing, choose Correction instead. Bring a copy of the record and documents that prove the missing information, such as a baptismal certificate, school records or IDs. Our staff will provide the supplemental report form.' WHERE purpose = 'Supplemental' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Acknowledgment is for a child whose parents were not married to each other. The father signs a document, such as an Affidavit of Acknowledgment or Admission of Paternity, stating that the child is his, and the child’s record is annotated. With this, the child may be allowed to use the father’s surname (Republic Act 9255), which is requested through an Affidavit to Use the Surname of the Father.

Acknowledgment does not make a child legitimate. If the parents later marry each other, see Legitimation. Both parents are usually asked to come in person.' WHERE purpose = 'Acknowledgment' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Legitimation changes a child’s status from illegitimate to legitimate. It applies when the child’s parents were free to marry each other when the child was conceived (or were prevented only because they were under 18) and later marry. The parents sign an Affidavit of Legitimation, and the child’s birth record is annotated.

It does not apply if either parent was married to someone else when the child was conceived. Bring the child’s birth certificate, the parents’ marriage certificate and valid IDs of both parents. Our staff will provide the form.' WHERE purpose = 'Legitimation' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this when the birth, death or marriage happened in a different city or municipality from where the record is kept or from where you are filing. Our staff receive your documents and coordinate with the other civil registry office so the record can be filed or obtained.

Because two offices are involved, this takes longer than a service done entirely here. Bring complete details of the event and the same documents required for that kind of registration or request.' WHERE purpose = 'Out of Town' AND (details IS NULL OR details = '');

UPDATE services SET details = 'Use this for anything not listed, such as annotations, endorsements or other civil registry concerns. When you book, briefly describe your concern in the box provided so that our staff can prepare before you arrive.

Bring a valid ID and any records related to your concern.' WHERE purpose = 'Others' AND (details IS NULL OR details = '');

SET SQL_SAFE_UPDATES = 1;
