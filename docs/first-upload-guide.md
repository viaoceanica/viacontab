# ViaContab First Upload Guide

This guide describes the current first-time upload experience in ViaContab based on a live simulation using a fresh database and a real invoice PDF.

Simulation reference:
- Date: 2026-04-07
- Test invoice: `aquarius-fatura.pdf`
- Result: upload and processing completed successfully

---

## What the user is trying to do

A first-time user wants to:
1. Open ViaContab
2. Upload an invoice file
3. Confirm that the invoice was accepted
4. Review and correct anything that still needs attention

---

## Before starting

The user should have:
- access to the ViaContab app
- at least one invoice file ready
- supported format: PDF, JPG, PNG, or ZIP

---

## First upload: step-by-step

### 1. Open the app
When the user opens ViaContab, they land on the main page.

The main navigation has three tabs:
- **Upload**
- **Queue**
- **Search**

The default view is **Upload**.

---

### 2. Confirm the tenant
In the Upload area there is a **Tenant** field.

What the user should do:
- confirm the tenant value is correct
- change it if needed before uploading

> Note: this is currently a manual step in the UI.

---

### 3. Select the invoice file
In the Upload section, use the file picker to choose a file.

Supported formats:
- PDF
- JPG
- PNG
- ZIP

What the user does:
- click the document picker
- select the invoice file

Example from the live simulation:
- `aquarius-fatura.pdf`

---

### 4. Start processing
Click:

**Processar faturas agora**

The app then runs a 4-step flow:
1. Validate
2. Extract
3. Review
4. Save

What the user sees:
- a progress bar
- current step highlighted in the stepper
- success or error feedback when the process ends

---

### 5. Read the result message
If processing succeeds, the app shows a success message.

This means:
- the file was accepted
- invoice extraction ran successfully
- the invoice should now be available in the queue

In the live simulation, the invoice was processed successfully.

Parsed result:
- Vendor: `Aquarius - Viagens e Turismo Lda`
- Invoice number: `FACT 2611/00141`
- Total: `35.00`

---

### 6. Open the Queue tab
After upload, the user should switch to **Queue**.

In Queue, the user can see:
- uploaded invoices
- invoice status
- extracted values
- actions such as open/edit/delete

This is the main place to verify whether the invoice is ready or still needs work.

---

### 7. Check review lines and blockers
Below the main queue table, the app shows support sections including:
- **Falhas de importação**
- **Revisão e bloqueios**

These sections are important even when the invoice upload succeeds.

In the live Aquarius simulation, the upload succeeded, but the app still generated:
- **3 lines in review**
- **1 blocker**

This means the invoice entered the system successfully, but still had line items that required manual review.

---

### 8. Open the invoice or PDF for correction
From the Queue and Review/Blockers sections, the user can open the invoice.

Current supported actions:
- open the invoice editor
- use the **👁️** action to open the PDF when available in storage

Use this step when the user needs to:
- inspect the original invoice visually
- compare extracted values with the document
- correct fields or line items

---

### 9. Correct the invoice
In the invoice detail area, the user can update:
- vendor
- category
- invoice number
- dates
- totals
- notes
- line items

Line descriptions support multi-line editing.

This is especially useful when a line item is long and needs to wrap naturally instead of staying on one long line.

---

### 10. Save the changes
Click:

**Guardar alterações**

Current behavior:
- the invoice is saved
- the detail panel closes automatically
- the user returns to the queue view

This makes it easier to continue reviewing the next item.

---

## What the user should expect after first upload

A successful first upload does **not always mean the invoice is fully finished**.

Possible outcomes:
- uploaded and fully accepted
- uploaded but still needs line review
- uploaded but has automation blockers
- rejected due to invalid file/document type

The important user behavior is:
- upload first
- then always check **Queue** and **Revisão e bloqueios**

---

## Example outcome from the live simulation

Invoice uploaded:
- `aquarius-fatura.pdf`

Observed results:
- invoice created in queue: **yes**
- file upload to Cloudflare storage: **yes**
- invoice processing: **yes**
- review lines: **3**
- blockers: **1**

Example review reasons found:
- `classificação com confiança baixa`

Example blocker:
- `line_items_need_review`
- message: `3 linha(s) com revisão pendente`

This is a good example of a successful upload that still requires human validation.

---

## Recommended user behavior

For a first-time user, the safest routine is:
1. Upload the file
2. Wait for success message
3. Go to Queue
4. Look for review items or blockers
5. Open the invoice/PDF
6. Correct and save

---

## Known UX friction points observed during simulation

These notes are useful for future product improvements and for support documentation.

### 1. The tenant field is technical
A new user may not know what a tenant is or whether it should be changed.

### 2. Upload success does not fully explain next steps
After success, the app does not strongly direct the user to the Queue tab.

### 3. A successful invoice can still have pending review
This can be confusing unless the guide clearly explains it.

### 4. Review and blocker sections are secondary in the layout
Users may miss them unless they scroll down.

### 5. Storage success is not explicitly visible
The app works, but the user does not always see whether the file was uploaded directly to Cloudflare or queued for later storage sync.

---

## Suggested short version for onboarding

### First upload in ViaContab
1. Open **Upload**
2. Confirm the **Tenant**
3. Select your invoice file
4. Click **Processar faturas agora**
5. Wait for the 4-step process to finish
6. Open **Queue**
7. If review lines or blockers appear, open the invoice or PDF
8. Correct the invoice and click **Guardar alterações**

---

## Support note

If the user says:
- “the invoice uploaded but still shows review items”

The correct explanation is:
- the upload succeeded
- the invoice exists in the system
- some extracted lines still need manual confirmation before the invoice is considered fully clean
