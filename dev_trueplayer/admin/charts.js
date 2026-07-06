import {
	Chart,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Tooltip,
	Filler,
	Legend,
} from 'chart.js';

// Register the pieces we use once for the whole admin bundle.
Chart.register( CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Filler, Legend );

export const BRAND = '#008dff';
export const BRAND_SOFT = 'rgba(0,141,255,0.15)';

export const noLegend = { plugins: { legend: { display: false } } };
