// src/components/HeatMapLayer.jsx
import { useEffect } from "react";
import { useMap, LayerGroup } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export default function HeatmapLayer({
  points = [], // Each point: [lat, lng, intensity]
  options = {}, // Additional heatmap options
  showLegend = false, // Show legend on map
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    // Auto-scale intensity if not provided
    const scaledPoints = points.map(([lat, lng, intensity]) => [
      lat,
      lng,
      intensity ?? 0.5, // default intensity if missing
    ]);

    // Create heat layer
    const heat = L.heatLayer(scaledPoints, {
      radius: options.radius || 25,
      blur: options.blur || 15,
      maxZoom: options.maxZoom || 17,
      minOpacity: options.minOpacity || 0.3,
      gradient: options.gradient || {
        0.1: "green",
        0.3: "yellow",
        0.6: "orange",
        1.0: "red",
      },
      ...options,
    }).addTo(map);

    // Optional legend
    let legendControl;
    if (showLegend) {
      legendControl = L.control({ position: "bottomright" });
      legendControl.onAdd = function () {
        const div = L.DomUtil.create(
          "div",
          "heatmap-legend p-2 bg-white rounded shadow text-sm"
        );
        div.innerHTML = `
          <strong>Heat Intensity</strong><br/>
          <span style="background:red;width:15px;height:15px;display:inline-block;margin-right:5px"></span> High<br/>
          <span style="background:orange;width:15px;height:15px;display:inline-block;margin-right:5px"></span> Medium<br/>
          <span style="background:green;width:15px;height:15px;display:inline-block;margin-right:5px"></span> Low
        `;
        return div;
      };
      legendControl.addTo(map);
    }

    // Cleanup
    return () => {
      map.removeLayer(heat);
      if (legendControl) map.removeControl(legendControl);
    };
  }, [map, points, options, showLegend]);

  return <LayerGroup />;
}
