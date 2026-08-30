// SpecBridge — Synthetic seed transcript
// EAGLE Utilities — PM planning meeting, fictional data.
// DO NOT replace with real client data.

export const SEED_TRANSCRIPT = `EAGLE Utilities — HV Transformer PM Planning Meeting
Date: 2026-03-15
Participants: Sarah Chen (Reliability Engineer), Marcus Webb (Planner), Ravi Iyer (Maximo Consultant)
Recorded by: SpecBridge Demo System

---

[00:00] Marcus Webb (Planner): Let's get started. We have a recurring problem with high-voltage transformer PM work orders. When they're generated automatically for high-criticality assets, nobody sets the priority — they just come in as normal, and the planner doesn't even know until they're already overdue.

[00:28] Sarah Chen (Reliability Engineer): That's exactly right. In our criticality model, any transformer rated CRITICALITY = 'HIGH' or above on the ASSETSPEC should automatically get WO priority 1. Right now it's sitting at the default — priority 3 — and there's no notification going out to the scheduler.

[01:02] Ravi Iyer (Maximo Consultant): OK so we need an Automation Script. When a PM work order is generated for an asset where the criticality attribute on the asset spec is HIGH, we set WOPRIORITY to 1, and we trigger an email to the planner responsible for that work center.

[01:31] Marcus Webb (Planner): The planner's email — can we get that from the PERSON record linked to the work center? We have a LEAD field on the WORKORDER that should map to a PERSON, and that person has an email address.

[01:49] Sarah Chen (Reliability Engineer): Yes. We can do: get WORKORDER.LEAD → look up PERSON.EMAIL. If it's null, fall back to the work center supervisor. And if that's also null, log a warning and skip the notification — don't let a missing email blow up the automation.

[02:15] Ravi Iyer (Maximo Consultant): Good. For the trigger: this should fire on the WORKORDER object, on INIT or SAVE, but only when WORKTYPE = 'PM' and it's a new record — we don't want to re-trigger on every save of an existing work order.

[02:41] Marcus Webb (Planner): Right. And we should check: is this a generated PM or a manual one? We should look at the PM field — if WORKORDER.PMNUM is not null, then it was auto-generated from a PM schedule.

[03:10] Sarah Chen (Reliability Engineer): So the full condition is: WORKTYPE = 'PM' AND PMNUM is not null AND the linked asset has CRITICALITY = 'HIGH' on ASSETSPEC.

[03:28] Ravi Iyer (Maximo Consultant): Correct. And the CRITICALITY field — in our Maximo environment it's stored as ASSETSPEC.ALNVALUE where ASSETSPEC.ASSETATTRID = 'CRITICALITY'. We need to look that up using getRelatedMbo.

[03:55] Marcus Webb (Planner): What happens if the asset has no criticality spec at all? Some older assets might not have that attribute populated.

[04:08] Ravi Iyer (Maximo Consultant): In that case, we default to normal priority — don't set WOPRIORITY, don't send an email. Just let the work order go through as normal. Log a warning message saying the asset has no criticality attribute.

[04:30] Sarah Chen (Reliability Engineer): We should also handle the case where the PM work order already has a priority set — maybe it was manually assigned by a supervisor. In that case, the script should NOT override it. Check WOPRIORITY first: if it's already 1 or 2, leave it alone.

[04:52] Ravi Iyer (Maximo Consultant): Good catch. So the full logic is:
1. Check WORKTYPE = 'PM' and PMNUM is not null — if not, exit.
2. Get the linked ASSET.
3. Look up ASSETSPEC where ASSETATTRID = 'CRITICALITY'.
4. If criticality is 'HIGH': check WOPRIORITY. If already 1 or 2, exit. Otherwise set to 1.
5. Get planner email from WORKORDER.LEAD → PERSON.EMAIL.
6. If email found, send notification. If not, try work center supervisor. If neither, log and continue.
7. Log all actions for audit trail.

[05:40] Marcus Webb (Planner): That covers everything on my side. Can we get this done by end of sprint?

[05:47] Sarah Chen (Reliability Engineer): The Maximo script itself should be straightforward — maybe a day's work. The main risk is the getRelatedMbo chain being slow on large datasets — Ravi, should we add any performance guard?

[06:00] Ravi Iyer (Maximo Consultant): We can do a lazy check — first look at ASSET.CRITICALITY if it exists as a direct field (some Maximo configs expose it), and only do the ASSETSPEC lookup if it's null. That avoids an unnecessary DB hit in most cases.

[06:18] Marcus Webb (Planner): OK. Acceptance criteria from my side: given a PM work order generated for an asset with CRITICALITY = HIGH, when the WO is saved, the priority must be 1 and the planner must receive an email within 5 minutes. For non-critical assets or manual work orders, no change.

[06:42] Sarah Chen (Reliability Engineer): Agreed. And we need a test scenario where the email address is missing — verify the WO still gets priority 1 even if no email is sent.

[06:55] Ravi Iyer (Maximo Consultant): I'll document the script name as SPECBRIDGE_PM_PRIORITY_V1 and the launch point as SPECBRIDGE_PM_PRIORITY_LP. Script language: Jython.

[07:10] Marcus Webb (Planner): Perfect. Let's close this out.

---
END OF TRANSCRIPT`;

export const SEED_TEMPLATE_HINT = `This is a synthetic meeting transcript from EAGLE Utilities.
It describes a Maximo PM work order automation enhancement.
Use it as the input to the SpecBridge generation pipeline.`;
