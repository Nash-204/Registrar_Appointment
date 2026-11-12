CHATBOT KNOWLEDGE FOLDER
========================

Put the information the chatbot may use in this folder as plain text files (.md or .txt).
You can also add, edit and delete them in the admin panel (Chatbot tab) without opening this folder.

How the chatbot uses them
- It already knows the office hours, the services, how long each takes, the documents to bring, and how to
  book and track an appointment. That comes live from the admin settings, so you do not repeat it here.
- Put everything ELSE here: fees and payment methods, processing times, holidays, office rules, address
  directions, what to do for special cases, and so on.
- When a visitor's question is not answered by these files or the live data, the chatbot does not guess.
  It hands the chat to a staff member.

Writing good files
- One topic per file, with short headings. For example:

    # Fees
    ## Certified copy of a birth certificate
    The fee is ... per copy. Payment is made at the cashier.

- Write plain, complete sentences. State the facts the way you would tell a visitor.
- Do not put anything here you do not want visitors to read. The chatbot may quote it.
- Convert PDF or Word documents to text first (copy and paste the text into a .txt file).

Files whose name starts with an underscore (_) or is README are ignored.
After editing files by hand in this folder, press "Rebuild knowledge" in the admin Chatbot tab (or wait a few minutes).
