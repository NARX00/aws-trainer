# SAP-C02 question breakdown method (requirements → grid)

Use it for any practice question. Adapted from the Pearson SAP-C02 course (2024).

## Starter prompt for a new chat
> Explain this SAP-C02 question with my breakdown method: requirements → questions to ask → grid → each answer → pattern to remember. Check facts on AWS docs and tell me if something in the source is outdated.

## The 5 steps
1. **Pull out the requirements.** Quote each phrase and label it: context, requirement 1, 2…, or decider (LEAST operational overhead · MOST cost-effective · LEAST application change · none = "which answer works at all").
2. **Questions to ask yourself.** Why does the problem happen? Which managed service fixes each requirement? Trap check: does every arrow in each answer exist in AWS?
3. **Draw the grid.** Rows = answers; columns = "Is the wiring possible?" + each requirement + the decider. Each cell ✓ / ✗ / partly with 3–5 words. The wiring column often removes 2–3 answers.
4. **Walk through each answer.** One or two sentences each; name the trap answer and the one word that makes it wrong.
5. **Pattern to remember.** One or two lines, "trigger words → service", for the trainer's "Your rule" box.

**"Which CANNOT / NOT" questions:** find the answers that work; the leftovers are the answer.

## Worked examples
| Question | Pattern |
|---|---|
| A48 · task 3.2 | Lambda + RDS + spikes + "connection errors" → RDS Proxy (credentials in Secrets Manager). "Slow" + Java or cold starts → provisioned concurrency, never "reserved". |
| A276 · task 3.4 | Unpredictable bursts + "no data loss" + devices calling an API → API Gateway → SQS → Lambda. Impossible arrows: ALB ↛ SQS, CloudFront ↛ Kinesis, no API Gateway "ASG proxy". |
| Open scenario 3.2 Q4 (DLP) | Inspect all outbound traffic, every port, resilient → Gateway Load Balancer + appliance fleet (or Network Firewall for domain/IPS filtering). A NAT gateway never inspects. |
| EBS "cannot" question | Existing EBS volumes are never encrypted in place; always go through a new volume. Encryption by default affects new volumes only. |
