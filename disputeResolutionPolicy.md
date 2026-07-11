# TradeShield Dispute Resolution Policy

**Version 1.0 — Reference document for pitch defense and engineering specification**

---

## 1. Purpose and Guiding Principle

Escrow only works if both sides trust the mechanism that governs it. A dispute process that favors the buyer by default undermines supplier trust; a process that makes disputes slow or evidence-free undermines buyer trust. This policy exists to make dispute resolution **fast, evidence-based, and proportionate** — protecting genuine claims without exposing suppliers to unilateral buyer discretion.

**Core principle:** A dispute is not "the buyer's opinion against the platform's default." It is a structured evidentiary process with defined categories, required evidence, fixed timelines, and a supplier right of reply. No dispute is resolved on one party's word alone.

---

## 2. What This Policy Deliberately Rejects

Before defining the mechanism, it's worth stating plainly what this policy does **not** do, since these are the natural but flawed alternatives:

- **It does not release partial funds automatically upon dispute filing.** Moolre transactions cannot be reversed once disbursed. Releasing any percentage before investigation creates a real risk of the platform absorbing losses it cannot recover, and it quietly reintroduces the exact payment risk the escrow model exists to eliminate.
- **It does not accept "I don't like it" as a valid dispute basis.** Subjective dissatisfaction with taste, color preference, or minor variation within normal product tolerance is not grounds for withholding payment from a supplier who delivered what was listed.
- **It does not leave suppliers waiting indefinitely.** Every dispute has a hard clock. Ambiguity that drags on for weeks is itself a harm to the supplier, independent of how the dispute is ultimately resolved.

---

## 3. Dispute Categories

Not all disputes carry the same evidentiary weight or urgency. Filing routes the case into one of three categories:

### 3.1 Non-Delivery / Wrong Item / Wrong Quantity

**Definition:** The order never arrived, the wrong product was sent, or the quantity received does not match the order record.// **Evidentiary bar:** Low — this is objectively verifiable against the order record itself (what was ordered vs. what the buyer confirms was received). **Resolution speed:** Fast-tracked. In most cases resolvable within 24 hours since the order record provides most of the needed evidence.

### 3.2 Damaged in Transit

**Definition:** The product arrived physically damaged, spoiled, or degraded in a way inconsistent with normal condition on shipment. **Evidentiary bar:** Medium — requires buyer photo/video evidence of the damaged goods at time of filing. **Resolution speed:** Standard timeline (see Section 5). May implicate a third-party courier rather than the supplier directly, which affects the resolution outcome (see Section 6).

### 3.3 Not As Described / Quality Dissatisfaction

**Definition:** The buyer claims the goods received materially differ from the product listing (e.g., listed as Grade A, delivered visibly substandard). **Evidentiary bar:** High — this is the category most exposed to potential abuse, and is treated accordingly. **Standard applied:** The platform adjudicates on **material discrepancy from the listing**, not subjective preference. The test is: *would a reasonable buyer, shown the listing and the delivered goods side by side, agree there is a genuine, describable discrepancy?* General dissatisfaction, buyer's remorse, or preferences not stated in the original listing do not meet this bar.

---

## 4. Filing Requirements

A dispute cannot be opened on a bare claim. To file, the buyer must submit, at time of filing:

1. **Photo evidence** of the goods as received (required for all categories except pure non-delivery, where evidence is the absence of goods itself)
2. **A written description** of the specific discrepancy — what was expected per the listing, and what was actually received
3. For quality disputes specifically: identification of which stated attribute of the listing (grade, quantity, condition, specification) is being disputed — a dispute must point to something the listing actually claimed, not an unstated expectation

Filing without meeting these requirements is rejected at submission, before it ever reaches the supplier or ties up any funds. This is a deliberate design choice: most frivolous disputes will not survive the requirement to produce evidence and put a specific, falsifiable claim in writing.

---

## 5. Timeline and Process


| Stage                    | Actor          | Window                                                     | Action                                                                     |
| ------------------------ | -------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Filing                | Buyer          | At time of delivery confirmation step, before auto-release | Submit evidence + written claim per Section 4                              |
| 2. Supplier Notification | Platform       | Immediate                                                  | Supplier notified, escrow release paused                                   |
| 3. Right of Reply        | Supplier       | 48 hours                                                   | Supplier submits counter-evidence (see Section 6) and written response     |
| 4. Admin Review          | Platform Admin | 48–72 hours from Stage 3                                   | Review both submissions against the listing and order record; issue ruling |
| 5. Resolution            | Platform       | Immediate upon ruling                                      | Funds released, refunded, or split per ruling (Section 7)                  |


**Total maximum dispute duration: 5 days from filing to resolution** under normal circumstances. This is the number to state confidently in a pitch: suppliers are never left in indefinite limbo — they know the maximum time their funds can be held pending investigation.

If the buyer fails to file within the standard delivery confirmation window (72 hours per the Feature Spec's auto-release rule), the dispute right expires and funds auto-release — a dispute cannot be filed retroactively after funds have already been disbursed under normal auto-release.

---

## 6. Supplier's Right of Reply

A dispute is not adjudicated on the buyer's evidence alone. The supplier has a defined opportunity to respond with:

- Pre-shipment photo/video evidence, if captured (recommended addition to the Fulfillment module — see Section 9)
- Courier/delivery confirmation records, where applicable
- A written response addressing the buyer's specific claim

This transforms dispute resolution from "buyer's word taken at face value" into an actual evidentiary comparison — the supplier is not presumed at fault by the act of a dispute being filed.

---

## 7. Resolution Outcomes

Admin review results in one of three outcomes, not a forced binary:

1. **Dispute unfounded** — funds release to supplier in full. This is the outcome when the buyer's evidence does not demonstrate a material discrepancy from the listing, or when the supplier's counter-evidence adequately rebuts the claim.
2. **Dispute upheld** — funds refund to buyer in full. Reserved for cases where the evidence clearly shows non-delivery, wrong item, or a genuine, significant discrepancy from the listing.
3. **Partial resolution** — funds split according to the proportion of the order actually affected. Example: an order of 50 bags where photo evidence shows 10 bags visibly spoiled and 40 in acceptable condition results in an 80/20 split (supplier receives payment for 40 bags, buyer is refunded for 10). This outcome exists because real-world disputes are rarely 100% one party's fault, and forcing every case into a full win/lose ruling produces unfair outcomes at the margins.

All rulings are logged immutably against the order, with the admin's reasoning recorded, for audit purposes and for pattern analysis (see Section 8).

---

## 8. Preventing Abuse Without Penalizing Legitimate Use

The policy tracks dispute outcomes per buyer account, not just dispute counts. The distinction matters: a buyer who files one dispute that gets upheld has had a bad experience and used the system correctly. A buyer with a pattern of disputes that are repeatedly ruled unfounded is a different case entirely.

**Escalating response to a pattern of unfounded disputes:**

- First unfounded dispute: no action — this is normal and expected
- Repeated pattern of unfounded disputes: account flagged for manual review before future orders are approved
- Continued pattern after flagging: buyer may be moved to a restricted tier (e.g., no dispute rights, or a lower auto-release threshold) or, in extreme and clearly documented cases, suspended from the platform

This creates consequences for abuse of the mechanism itself, without discouraging any individual buyer from filing a legitimate claim the first time something genuinely goes wrong.

---

## 9. Recommended Product Changes to Support This Policy

Two additions to the existing Feature Specification Document would materially strengthen this policy's enforceability:

1. **Pre-shipment photo capture for suppliers** (addition to the Fulfillment module): supplier optionally or mandatorily photographs goods immediately before marking an order as shipped. This creates the timestamped counter-evidence referenced in Section 6, and its absence in the original Feature Spec is worth addressing before this policy goes into production.
2. **Structured dispute filing form** (addition to the Dispute Handling module): rather than a free-text "report an issue" field, the filing UI should enforce the category selection and evidence requirements from Sections 3–4 at the point of submission, not as a manual admin check afterward.

---

## 10. How to State This in a Pitch

If challenged on whether buyers have too much unilateral power over supplier funds, the concise defense is:

*"A dispute isn't a buyer's opinion — it's a structured claim that requires photo evidence, a specific written discrepancy from the listing, and gives the supplier a right of reply before any ruling. The maximum time a supplier's funds can be held pending investigation is five days, and outcomes can be partial, not just win-or-lose. We also track dispute patterns, so a buyer who repeatedly files claims that turn out to be unfounded loses standing on the platform. The mechanism protects genuine claims while making abuse expensive and slow to execute, not free and instant."*