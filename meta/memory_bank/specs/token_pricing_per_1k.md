# Pricing Simplification (Per-Unit / Per-1k Tokens)

## Goal

Simplify rate cards so pricing is always raw per-unit, with text using per-1k token prices.

## Scope

- Text modality (`token_in`, `token_out`) uses per-1k token prices.
- Non-text modalities (image/tts/stt) use per-unit prices.
- Cost calculation = raw price _ units _ discount, summed for input+output tokens.
- Remove platform factor, fixed fee, min charge, and rounding rules from pricing.

## Formula

```
cost_kopeks = ceil(
  input_tokens  / 1000 * price_in_per_1k_kopeks * discount_factor
+ output_tokens / 1000 * price_out_per_1k_kopeks * discount_factor
)
```

For non-text modalities:

```
cost_kopeks = ceil(units * price_per_unit_kopeks * discount_factor)
```

## Admin UI

- For `modality=text` in create mode, require both input and output prices.
- Show labels explicitly as “per 1k tokens”.
- Remove platform factor / fixed fee / min charge / rounding rules from UI entirely.

## Data Notes

- Existing rate cards should be updated to final per-1k prices for text.
- Existing non-text rate cards should be updated to final per-unit prices.
- Database migration removes platform/fixed/min/rounding columns from rate cards.
