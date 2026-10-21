/** Run with: playwright-cli run-code --filename scripts/check_legal_checkbox_geometry.js
 * Open the legal gate first. This check never submits legal acceptance.
 * @param {import('@playwright/test').Page} page
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Invoked by playwright-cli.
async function checkLegalCheckboxGeometry(page) {
	const checkboxes = page.locator('input[id^="legal-"][type="checkbox"]');
	await checkboxes.first().waitFor();
	const results = [];
	for (const width of [320, 390, 1280]) {
		await page.setViewportSize({ width, height: 1000 });
		for (const checked of [false, true]) {
			for (const checkbox of await checkboxes.all()) await checkbox.setChecked(checked);
			const boxes = await checkboxes.evaluateAll((inputs) =>
				inputs.map((input) => {
					const box = input.getBoundingClientRect();
					const label = document.querySelector(`label[for="${input.id}"]`);
					return {
						width: box.width,
						height: box.height,
						left: box.left,
						topOffset: box.top - label.getBoundingClientRect().top
					};
				})
			);
			if (
				boxes.length !== 3 ||
				boxes.some(
					(box) =>
						Math.abs(box.width - 16) > 0.1 ||
						Math.abs(box.height - 16) > 0.1 ||
						Math.abs(box.topOffset - 4) > 0.1 ||
						Math.abs(box.left - boxes[0].left) > 0.1
				)
			)
				throw new Error(`Invalid geometry at ${width}px: ${JSON.stringify(boxes)}`);
			results.push({ viewport: width, checked, boxes });
		}
	}
	const first = checkboxes.first();
	await first.focus();
	await page.keyboard.press('Space');
	if (await first.isChecked()) throw new Error('Space must toggle the checkbox');
	const firstId = await first.getAttribute('id');
	await page.locator(`label[for="${firstId}"]`).click({ position: { x: 5, y: 5 } });
	if (!(await first.isChecked())) throw new Error('Label must toggle the checkbox');
	return results;
}
