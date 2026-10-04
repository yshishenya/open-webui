// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import MapSelector from '$lib/components/common/Valves/MapSelector.svelte';

const api = vi.hoisted(() => ({
	setView: vi.fn(),
	on: vi.fn(),
	fitBounds: vi.fn(),
	getZoom: vi.fn(() => 10),
	remove: vi.fn(),
	removeLayer: vi.fn(),
	marker: vi.fn(),
	featureGroup: vi.fn(),
	tileLayer: vi.fn(),
	map: vi.fn(),
	bounds: { valid: true }
}));
vi.mock('leaflet', () => ({
	default: {
		map: api.map,
		tileLayer: api.tileLayer,
		marker: api.marker,
		featureGroup: api.featureGroup
	}
}));
let component: Record<string, unknown> | null = null;
let target: HTMLDivElement | null = null;
const settle = async (): Promise<void> => {
	await vi.waitFor(() => expect(api.on).toHaveBeenCalledWith('click', expect.any(Function)));
};
const render = async (location: number[] | null, onClick = vi.fn()): Promise<void> => {
	target = document.createElement('div');
	document.body.append(target);
	component = mount(MapSelector, { target, props: { setViewLocation: location, onClick } });
	await settle();
};
beforeEach(() => {
	vi.clearAllMocks();
	api.fitBounds.mockReset();
	const map = {
		setView: api.setView,
		on: api.on,
		fitBounds: api.fitBounds,
		getZoom: api.getZoom,
		remove: api.remove,
		removeLayer: api.removeLayer
	};
	api.map.mockReturnValue(map);
	api.setView.mockReturnValue(map);
	api.tileLayer.mockReturnValue({ addTo: vi.fn() });
	api.marker.mockReturnValue({ bindPopup: vi.fn() });
	api.featureGroup.mockImplementation(() => {
		const group = { addTo: (): object => group, getBounds: (): object => api.bounds };
		return group;
	});
});
afterEach(async () => {
	if (component) await unmount(component);
	target?.remove();
	component = null;
	target = null;
	vi.restoreAllMocks();
});
it.each<[number[] | null, number[]]>([
	[
		[0, 0],
		[0, 0]
	],
	[null, [51.505, -0.09]]
])('keeps the existing initial view for %j', async (location, center) => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	await render(location);
	expect(api.map).toHaveBeenCalledWith(expect.any(HTMLDivElement), { zoomAnimation: false });
	expect(api.setView).toHaveBeenCalledWith(center, 10);
	expect(api.marker).toHaveBeenCalledTimes(location ? 1 : 0);
	expect(warn).not.toHaveBeenCalled();
});
it('publishes the chosen coordinates and removes the previous marker and map', async () => {
	const save = vi.fn();
	await render([0, 0], save);
	const callback = api.on.mock.calls.find(([event]) => event === 'click')?.[1] as (event: {
		latlng: { lat: number; lng: number };
	}) => void;
	callback({ latlng: { lat: 5, lng: 6 } });
	expect(save).toHaveBeenCalledWith('5, 6');
	expect(api.removeLayer).toHaveBeenCalledOnce();
	await unmount(component!);
	component = null;
	expect(api.remove).toHaveBeenCalledOnce();
});
it('reports a bounds failure while preserving click handling and cleanup', async () => {
	const failure = new Error('Invalid bounds');
	api.fitBounds.mockImplementation(() => {
		throw failure;
	});
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	await render([0, 0]);
	expect(warn).toHaveBeenCalledWith('Could not fit map bounds', failure);
	expect(api.on).toHaveBeenCalledWith('click', expect.any(Function));
});
