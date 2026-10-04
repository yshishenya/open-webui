<script>
	import { onMount, onDestroy } from 'svelte';

	let map;
	let mapElement;

	/** @type {number[] | null} */
	export let setViewLocation = [51.505, -0.09];
	export let points = [];

	/** @type {(value: string) => void} */
	export let onClick = () => {};

	let markerGroupLayer = null;

	onMount(async () => {
		const [{ default: L }] = await Promise.all([
			import('leaflet'),
			import('leaflet/dist/leaflet.css')
		]);

		// Leaflet 1.9.4 can finish a zoom after remove() and touch the deleted map pane.
		map = L.map(mapElement, { zoomAnimation: false }).setView(
			setViewLocation ? setViewLocation : [51.505, -0.09],
			10
		);

		if (setViewLocation) {
			points = [
				{
					coords: setViewLocation,
					content: `Lat: ${setViewLocation[0]}, Lng: ${setViewLocation[1]}`
				}
			];
		}

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);

		/** @param {{coords: number[], content: string}[]} points @returns {void} */
		const setMarkers = (points) => {
			if (map) {
				if (markerGroupLayer) {
					map.removeLayer(markerGroupLayer);
				}

				let markers = [];
				for (let point of points) {
					const marker = L.marker(point.coords).bindPopup(point.content);

					markers.push(marker);
				}

				markerGroupLayer = L.featureGroup(markers).addTo(map);

				try {
					if (markers.length > 0) {
						map.fitBounds(markerGroupLayer.getBounds(), {
							maxZoom: Math.max(map.getZoom(), 13)
						});
					}
				} catch (error) {
					console.warn('Could not fit map bounds', error);
				}
			}
		};

		setMarkers(points);

		map.on('click', (e) => {
			console.log(e.latlng);
			onClick(`${e.latlng.lat}, ${e.latlng.lng}`);

			setMarkers([
				{
					coords: [e.latlng.lat, e.latlng.lng],
					content: `Lat: ${e.latlng.lat}, Lng: ${e.latlng.lng}`
				}
			]);
		});
	});

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<div class=" z-10 w-full">
	<div bind:this={mapElement} class="h-96 z-10"></div>
</div>
