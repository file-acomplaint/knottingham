/*
KNOTTINGHAM
author: fi-le (info@fi-le.net)
licence: MIT
© 2023

To be interoperable with Paper.js, this file uses only limited JavaScript functionality.
For example, match statements, const,

*/


// Some functions in global scope to interoperate with the
// non-paperscript code:
globals.updateStyle = function () {
	for (var i = 0; i < knotList.length; i++) {
		knotList[i].strokeWidth = globals.strokeWidth;
		knotList[i].strokeColor = globals.strokeColor;
	}
	showIntersections({});
}

globals.undo = function () { popUndo(); }
globals.straighten = function () {
	for (var i = 0; i < knotList.length; i++) knotList[i].clearHandles();
	showIntersections({}); globals.smooth = false; discreteMove = true;
}
globals.flatten = function () {
	for (var i = 0; i < knotList.length; i++) knotList[i].flatten(1);
	showIntersections({ "spatial": true }); globals.smooth = false;
}
globals.simplify = function () {
	for (var i = 0; i < knotList.length; i++) knotList[i].simplify(0.3);
	showIntersections({}); globals.smooth = false;
}
globals.reflect = function () {
	// Mirror the knot horizontally
	if (knotList.length == 0) return;
	var bounds = knotList[0].bounds;
	for (var i = 1; i < knotList.length; i++) bounds = bounds.unite(knotList[i].bounds);
	var x_average = bounds.x + bounds.width / 2;

	var center = new Point(x_average, 0);
	for (var i = 0; i < knotList.length; i++) knotList[i].scale(-1, 1, center);

	// Mirror the intersection points
	for (var k = 0; k < intersectionWatcher[0].length; k++) {
		intersectionWatcher[0][k].x += 2 * (x_average - intersectionWatcher[0][k].x);
	}

	showIntersections({});
	pushUndo();
}
globals.makeAlternating = function () {
	// Get all intersection times and sort them
	var intersectionTimes = [];
	for (var i = 0; i < window.globals.getNumIntersections(); i++) {
		// Add both times for each intersection
		intersectionTimes.push({
			index: i,
			time: intersectionWatcher[2][i],
			isFirst: true
		});
		intersectionTimes.push({
			index: i,
			time: intersectionWatcher[3][i],
			isFirst: false
		});
	}

	// Sort by time along the curve
	intersectionTimes.sort(function (a, b) { return a.time - b.time; });

	// Assign alternating over/under
	var isOver = true; // Start with going over
	for (var i = 0; i < intersectionTimes.length; i++) {
		var crossing = intersectionTimes[i];
		if (crossing.isFirst) {
			// When we encounter the first point of a crossing, set its boolean
			intersectionWatcher[1][crossing.index] = isOver;
		}
		isOver = !isOver; // Alternate for next crossing
	}

	// Update display
	window.globals.switchIsomorphy();
	pushUndo();
}
globals.toSVG = function () { return project.exportSVG({ bounds: 'content' }); }
globals.toJSON = function () {
	var objects = [];
	for (var i = 0; i < knotList.length; i++) objects.push(knotList[i].exportJSON({ asString: false }));
	return JSON.stringify([objects, intersectionWatcher]);
}
globals.fromJSON = function (jsonString) {
	var obj = JSON.parse(jsonString);
	resetProject();

	var knotData = obj[0];
	if (Array.isArray(knotData) && knotData.length == 0) {
		// New format, empty canvas
		activeKnot = new Path();
		knotList.push(activeKnot);
	} else if (Array.isArray(knotData) && knotData.length > 0 && Array.isArray(knotData[0])) {
		// New format (array of paths)
		for (var i = 0; i < knotData.length; i++) {
			var k = new Path();
			k.importJSON(JSON.stringify(knotData[i]));
			knotList.push(k);
		}
		activeKnot = knotList[0];
	} else {
		// Old format (single knot)
		var k = new Path();
		k.importJSON(JSON.stringify(knotData));
		activeKnot = k;
		knotList.push(k);
	}
	var intersections = obj[1];
	intersectionWatcher = intersections;

	for (var k = 0; k < intersections[1].length; k++) {
		intersectionWatcher[1][k] = intersections[1][k];
		intersectionWatcher[0][k] = new Point(intersections[0][k][1], intersections[0][k][2]);
	}
	// activeKnot.closed = true; // All should be closed
	for (var i = 0; i < knotList.length; i++) knotList[i].closed = true;
}
globals.select = function () {
	var bool = activeKnot.fullySelected;
	for (var i = 0; i < knotList.length; i++) {
		knotList[i].fullySelected = false;
		knotList[i].fullySelected = !bool;
	}
	hitOptions.handles = true;
}
globals.draw = function () {
	drawing = true;
	resetProject();
	globals.smooth = false;
}
globals.drawLink = function () { drawing = true; globals.smooth = false; knotLayer.activate(); }

globals.toTikz = function (scale) {
	// Tikz's coordinates go down, not up
	for (var i = 0; i < knotList.length; i++) knotList[i].scale(1, -1);

	// This is the preamble to initialise and style the knot
	var out = "\\begin{tikzpicture}\n\\begin{knot}[consider self intersections=no splits,end tolerance=1pt,line join=round,clip width=1,ignore endpoint intersections=true,background color=red,every intersection/.style={line width=4pt,only when rendering/.style={draw=white,line width=2pt,double=none,}},only when rendering/.style={red,line width=1pt,double=white,double distance=2pt,},flip crossing/.list={1,3,5,7}]\n";

	function pointToString(p) {
		return "(" + Math.round(p.x) / 100 + ',' + Math.round(p.y) / 100 + ')';
	}

	for (var i = 0; i < knotList.length; i++) {
		out += "\\strand\n";
		var l = knotList[i].curves.length;
		for (var k = 0; k < l; k++) {
			points = knotList[i].curves[k].points;

			// Defining the strand through cubic bezier curves (Paper Script doesn't support string templates)
			out += pointToString(points[0]) + ".. controls " + pointToString(points[1]) + " and " + pointToString(points[2]) + " .. " + pointToString(points[3]) + (k == l - 1 ? ';\n' : '--\n');
		}
	}

	out += '\\end{knot}\n\\end{tikzpicture}';

	for (var i = 0; i < knotList.length; i++) knotList[i].scale(1, -1);
	return out;
}

globals.toPD = function () {
	// The PD code of the current diagram in the KnotTheory convention: each crossing
	// lists its four edges counterclockwise, starting from the incoming under-strand.
	// Returns null if a component has no crossings, which a PD code cannot express.
	var passages = [];
	for (var c = 0; c < knotList.length; c++) passages.push([]);

	for (var i = 0; i < intersections.length; i++) {
		var t1 = intersectionWatcher[2][i];
		var t2 = intersectionWatcher[3][i];
		// intersectionWatcher[1] == true means the first location passes under
		passages[Math.floor(t1 / COMPONENT_OFFSET)].push({ time: t1 % COMPONENT_OFFSET, crossing: i, under: intersectionWatcher[1][i] });
		passages[Math.floor(t2 / COMPONENT_OFFSET)].push({ time: t2 % COMPONENT_OFFSET, crossing: i, under: !intersectionWatcher[1][i] });
	}

	// The edge after the k-th passage of a component gets the k-th label,
	// so labels increase along the orientation and wrap around per component.
	var edgeCount = 0;
	var underPassage = {};
	var overPassage = {};
	for (var c = 0; c < knotList.length; c++) {
		var m = passages[c].length;
		if (m == 0) return null;
		passages[c].sort(function (a, b) { return a.time - b.time; });
		for (var k = 0; k < m; k++) {
			var p = passages[c][k];
			p.inEdge = edgeCount + ((k - 1 + m) % m) + 1;
			p.outEdge = edgeCount + k + 1;
			if (p.under) { underPassage[p.crossing] = p; } else { overPassage[p.crossing] = p; }
		}
		edgeCount += m;
	}

	var out = [];
	for (var i = 0; i < intersections.length; i++) {
		var overLoc = intersectionWatcher[1][i] ? intersections[i].intersection : intersections[i];
		var underLoc = intersectionWatcher[1][i] ? intersections[i] : intersections[i].intersection;
		var under = underPassage[i];
		var over = overPassage[i];
		if (!under || !over) return null;

		if (overLoc.tangent.cross(underLoc.tangent) < 0) { // Positive crossing; the y-axis points down
			out.push([under.inEdge, over.outEdge, under.outEdge, over.inEdge]);
		} else {
			out.push([under.inEdge, over.inEdge, under.outEdge, over.outEdge]);
		}
	}
	return JSON.stringify(out);
}

globals.switchIsomorphy = function () {
	showIntersections({});
	pushUndo();
}

globals.getNumIntersections = function () { return intersectionWatcher[0].length; }
globals.getNumComponents = function () { return knotList.length; }

var logStack = 0;
function setLog(s) {
	logStack += 1;
	log.innerHTML = s;
	setTimeout(function () {
		logStack -= 1;
		if (logStack == 0) {
			log.innerHTML = "";
		}
	}, 5000);
}

var hitOptions = {
	segments: true,
	stroke: true,
	handles: false,
	fill: true,
	tolerance: 5
};

// This next object tracks the intersections for the purpose of matching them between frames.
// It is bundled in one JavaScript object to simplify serialisation.
// intersectionWatcher[0] contains the location of crossings detected by path.getIntersections()
// intersectionWatcher[1]  = boolean array of whether to cross over or under in the second value
// intersectionWatcher[2],[3] = time points of the intersections (t,s) where t < s
var intersectionWatcher = [[], [], [], []];
function resetIntersections() { intersectionWatcher = [[], [], [], []] }
function resetProject() {
	paper.project.clear();
	knotList = [];
	knotLayer = new Layer(); // Created first, so it renders below the intersections
	intersectionLayer = new Layer();
	knotLayer.activate(); // New paths land on the knot layer
	resetIntersections();
}
var previousGaussCode = [-1, 2, -3, 4, -5, 6, -1, 2, -7, -8, -3, 4, -5, -9, 10, 6, 7, -11, 8, -9, 10, 11];
var previousPolynomial = null;
var reidemeister3s = []; // We keep track of location and dominant direction in places with soon-to-be Reidemeister 3 moves.

// Some constants
var REIDEMEISTER_DISTANCE_THRESHOLD = 25;
var REIDEMEISTER_DOT_THRESHOLD = 0.97;
var drawing = false;
var strokeColor = 'black';


// We initialise a knot and style it
var knot = new Path();
knot.strokeColor = strokeColor;
knot.strokeWidth = window.globals.strokeWidth;
knot.selected = true;
knot.data = { kind: 'knot' };
var activeKnot = knot.clone();
var knotList = [activeKnot];
var COMPONENT_OFFSET = 100000;
knot.remove();

// We display this pretty Conway knot as a default
var conway = '[["Path",{"applyMatrix":true,"data":{"z":[120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990]},"segments":[[[459.65702,250.73854],[-24.27032,34.67315],[24.27032,-34.67315]],[[585.221,145.19855],[-41.73615,13.03309],[41.73615,-13.03309]],[[652.72995,191.64882],[-1.858,-27.71579],[1.858,27.71579]],[[616.03243,257.93123],[18.35672,-14.90263],[-18.35672,14.90263]],[[567.24533,279.69557],[13.91572,-0.72045],[-13.91572,0.72045]],[[517.09828,245.39982],[24.91454,30.31584],[-24.91454,-30.31584]],[[458.93469,129.08133],[-5.26322,30.07134],[5.26322,-30.07134]],[[539.13704,116.89188],[-25.9004,-22.09327],[25.9004,22.09327]],[[591.37488,208.4135],[-23.57535,-21.03046],[23.57535,21.03046]],[[668.35285,250.20658],[-9.01399,-27.0996],[9.01399,27.0996]],[[614.45711,360.86091],[36.5491,-23.01854],[-36.5491,23.01854]],[[523.73789,337.8169],[7.43257,31.56343],[-7.43257,-31.56343]],[[554.98845,221.95979],[-6.8107,35.66592],[6.8107,-35.66592]],[[510.42066,159.01408],[33.12748,4.57572],[-33.12748,-4.57572]],[[407.35165,200.4479],[21.93757,-32.45693],[-21.93757,32.45693]],[[406.0382,321.18015],[-16.49532,-36.91409],[16.49532,36.91409]],[[493.83892,378.75649],[-42.44355,1.80469],[42.44355,-1.80469]],[[595.06071,329.16123],[-2.753,21.71426],[2.753,-21.71426]],[[491.47104,285.78427],[55.82343,4.31048],[-55.82343,-4.31048]],[[357.25535,311.78686],[17.26465,-21.58181],[-17.26465,21.58181]],[[390.64736,369.43924],[-24.05836,-1.6382],[24.05836,1.6382]],[[441.16185,318.47278],[-4.9377,21.44867],[4.9377,-21.44867]]],"closed":true,"strokeColor":[0,0,0],"strokeWidth":5}],[[["Point",492.33905,212.2744],["Point",539.65842,170.53925],["Point",562.99791,155.19926],["Point",642.22344,229.17864],["Point",539.03057,268.74746],["Point",464.8165,162.62964],["Point",548.41205,366.2197],["Point",530.45528,291.09567],["Point",396.34589,291.95197],["Point",424.68266,350.71969],["Point",443.73223,285.26418]],[true,false,true,false,true,true,true,false,false,true,false],[0.3222718860335728,0.6676938272100768,0.8324981757509241,2.4938395079638798,4.648565158332058,5.692755134293183,10.599394461139504,11.421193900272069,14.755117242539102,15.305904534276992,18.284121781578932],[5.3025547245038425,12.644418852623978,7.425046154683973,8.577522764938148,11.602517992981657,13.411534598079108,16.410991901629924,17.75754956888229,18.59651925410013,20.530253587004893,21.570421731873093]]]';
var knotLayer = project.activeLayer;
var intersectionLayer = null; // Both layers are (re)created in resetProject
globals.fromJSON(conway);

var intersections = activeKnot.getIntersections(activeKnot);

// We initialise a Stack for Undoing:
var undoStack = [];
var lastMousePosition = new Point(0, 0);
function pushUndo() { if (undoStack.length > 40) undoStack.shift(); undoStack.push(globals.toJSON()); }
function popUndo() { if (undoStack.length > 0) { globals.fromJSON(undoStack.pop()); typesetInvariants(); } }
pushUndo();
globals.switchIsomorphy();

// Encodes a curve location as time + segment index + component index * COMPONENT_OFFSET
function getTime(loc) {
	var path = loc.path || loc.curve.path;
	var cIdx = knotList.indexOf(path);
	if (cIdx == -1) cIdx = 0;
	return loc.time + loc.index + cIdx * COMPONENT_OFFSET;
}

// The canonical metric on [0,1] where 0 is connected to 1, per component.
function metric(a, b) {
	if (Math.floor(a / COMPONENT_OFFSET) != Math.floor(b / COMPONENT_OFFSET)) return 10000000;
	var idx = Math.floor(a / COMPONENT_OFFSET);
	if (idx >= knotList.length) return 10000000;
	var len = knotList[idx].segments.length;
	var a_loc = a % COMPONENT_OFFSET;
	var b_loc = b % COMPONENT_OFFSET;
	return Math.min(Math.abs(a_loc - b_loc),
		Math.abs(a_loc - b_loc + len),
		Math.abs(a_loc - b_loc - len));
}

function showIntersections(kwargs) { // This detects and draws crossings. Runs every frame.
	if (!kwargs.skipMatching) {
		intersectionLayer.removeChildren();
		intersections = [];
		for (var i = 0; i < knotList.length; i++) {
			for (var j = i; j < knotList.length; j++) {
				var cross;
				if (i == j) {
					cross = knotList[i].getCrossings(knotList[i]);
				} else {
					cross = knotList[i].getCrossings(knotList[j]);
				}
				intersections = intersections.concat(cross);
			}
		}

		// Let's map observed intersections to previous intersections
		// First, the case when an intersection was added:
		if (intersectionWatcher[0].length < intersections.length || kwargs.spatial) {
			var bools = Array(intersections.length).fill(false);
			var used_indices = Array(intersections.length).fill(false);
			for (var i = 0; i < intersectionWatcher[0].length; i++) {
				var previous = intersectionWatcher[0][i];

				// we calculate the index in //intersections// of the point that is closest to //previous//.
				var min = 99999999999999;
				var min_index = 0;
				for (var k = 0; k < intersections.length; k++) {
					var distance = intersections[k].point.getDistance(previous);

					if (distance < min) {
						min = distance;
						min_index = k;
					}
				}
				// We copy the over-under boolean from this minimal value
				bools[min_index] = intersectionWatcher[1][i];
				used_indices[min_index] = true;
			}

			var counter = 0;
			for (var i = 0; i < used_indices.length; i++) {
				if (!used_indices[i]) {
					counter += 1;
					idx = 0;
					if (segment) {
						var segmentComponent = knotList.indexOf(segment.path);
						if (segmentComponent == -1) segmentComponent = 0;
						idx = segment.index + segmentComponent * COMPONENT_OFFSET;
					}
					bools[i] = metric(getTime(intersections[i]), idx) > metric(getTime(intersections[i].intersection), idx)
				}
			}
			if (counter > 3) { console.log("Something unexpected happened"); };
			intersectionWatcher[1] = bools;
		}

		// Next, the case when the number of intersections is less then or equal the previous (i.e. possibly vanished):
		else if (intersectionWatcher[0].length >= intersections.length && !kwargs.spatial) {
			var bools = Array(intersections.length).fill(false); // The soon-to-be booleans of the next frame, to be found out.
			var used_indices = Array(intersectionWatcher[0].length).fill(false);

			for (var i = 0; i < intersections.length; i++) {
				var intersection = intersections[i].point;
				var intersectionTime = getTime(intersections[i]);
				var intersectionTime2 = getTime(intersections[i].intersection);

				// We calculate the index in //intersectionWatcher[0]// of the point that is closest to //intersection//.
				var min = 99999999999999;
				var second = 99999999999998;
				var min_index = 0;
				var second_index = -1;

				var flip = false;
				for (var k = 0; k < intersectionWatcher[0].length; k++) {
					var distance = metric(intersectionWatcher[2][k], intersectionTime) + metric(intersectionWatcher[3][k], intersectionTime2);

					if (distance < min) {
						second = min;
						second_index = min_index;
						min = distance;
						min_index = k;
					} else if (distance < second) {
						second = distance;
						second_index = k;
					}
				}
				// In case the intersection loops around the other side.
				// Might be efficient to add a check whether this loop can be omitted.
				for (var k = 0; k < intersectionWatcher[0].length; k++) {
					var distance = metric(intersectionWatcher[3][k], intersectionTime) + metric(intersectionWatcher[2][k], intersectionTime2) //
					if (distance < min) {
						second = min;
						second_index = min_index;
						min = distance;
						min_index = k;
						flip = true;
						console.log("Intersection loops around.");
					} else if (distance < second) {
						second = distance;
						second_index = k;
					}
				}
				// We copy the over-under boolean from this minimal value
				bools[i] = intersectionWatcher[1][min_index];
				if (flip) { bools[i] = !bools[i] }

				used_indices[min_index] = true;
			}

			var array = [];
			var illegal = false;
			if (globals.isomorphy) {
				if (intersectionWatcher[0].length > intersections.length) {
					for (var i = 0; i < used_indices.length; i++) {
						if (!used_indices[i]) {
							array.push(i);
						}
					}

					// array.length == 1 is a Reidemeister 1 and nothing can break

					if (array.length == 2) { // This should be a Reidemeister 2
						if (selectedEnd ^ (intersectionWatcher[1][array[0]] != intersectionWatcher[1][array[1]])) {
							popUndo();
							illegal = true;
							setLog("Illegal Reidemeister 2.");
						}
					} else if (array.length > 2) { // Something went wrong.
						console.log("Something unexpected happened...");
						illegal = true;
						if (undoStack.length > 0) globals.fromJSON(undoStack.pop());
					}
				}

				// This block is for detecting illegal Reidemeister 3 moves.
				var closest_indices = Array(intersections.length).fill(false);
				var second_indices = Array(intersections.length).fill(false);
				var second_distances = Array(intersections.length).fill(false);
				for (var i = 0; i < intersections.length; i++) {
					var intersection = intersections[i].point;
					var min = 99999999999999;
					var second = 99999999999998;
					var min_index = 0;
					var second_index = -1;

					for (var k = 0; k < intersections.length; k++) {
						if (k == i) continue;
						var distance = intersections[k].point.getDistance(intersection);
						if (distance < min) {
							second = min;
							second_index = min_index;
							min = distance;
							min_index = k;
						} else if (distance < second) {
							second = distance;
							second_index = k;
						}
					}

					closest_indices[i] = min_index;
					second_indices[i] = second_index;
					second_distances[i] = second;
				}

				for (var i = 0; i < intersections.length; i++) {
					intersection = intersections[i];
					closest_index = closest_indices[i];
					second_index = second_indices[i];
					second = second_distances[i] / REIDEMEISTER_DISTANCE_THRESHOLD;
					if (second < 1) {
						var vector1 = bools[i] ? intersection.tangent : intersection.intersection.tangent;
						var vector2 = bools[closest_index] ? intersections[closest_index].tangent : intersections[closest_index].intersection.tangent;
						var vector3 = bools[second_index] ? intersections[second_index].tangent : intersections[second_index].intersection.tangent;

						var max_coliniarity = Math.max(Math.abs(vector1.dot(vector2)), Math.abs(vector2.dot(vector3)), Math.abs(vector3.dot(vector1)));

						if (max_coliniarity < 0.9999 - second * second * second * second) {
							setLog("Illegal Reidemeister 3.");
							illegal = true;
							popUndo();
						}
					}
				}
			}

			if (!illegal) {
				resetIntersections();
				intersectionWatcher[1] = bools;
			}
		}
	}

	for (var i = 0; i < intersections.length; i++) {
		var intersect = intersections[i];
		intersectionWatcher[0][i] = intersect.point;
		intersectionWatcher[2][i] = getTime(intersect);
		intersectionWatcher[3][i] = getTime(intersect.intersection);
	}

	// We create 2 new paths on a new layer to display the intersection
	for (var i = 0; i < intersections.length; i++) {
		var intersect = intersections[i];

		// This would need to be two variables for multiple knots.
		var kPath = intersect.path;

		intersect.curve.data = {};

		var curve1 = intersect.curve;
		var t1 = intersect.time;

		var tangent1 = intersect.tangent;
		var tangent2 = intersect.intersection.tangent;

		if (intersectionWatcher[1][i]) {
			t1 = intersect.intersection.time;
			tangent1 = intersect.intersection.tangent;
			tangent2 = intersect.tangent;
			curve1 = intersect.intersection.curve;
		}
		var alpha = 1.3 * Math.abs(tangent1.dot(tangent2));
		var radius = (globals.gapWidth * Math.tan(alpha) + 2 * globals.strokeWidth / Math.cos(alpha)) / curve1.length;
		var segments1 = [curve1.getPart(t1 - radius, t1 + radius).segment1.clone(), curve1.getPart(t1 - radius, t1 + radius).segment2.clone()];
		var segments2 = [curve1.getPart(t1 - radius * 1.01, t1 + radius * 1.01).segment1.clone(), curve1.getPart(t1 - radius * 1.01, t1 + radius * 1.01).segment2.clone()];

		var gapPath = new Path({
			segments: segments1,
			strokeColor: 'white',
			strokeWidth: window.globals.gapWidth * window.globals.strokeWidth,
			data: { kind: 'intersection', i1: i, path: kPath },
			locked: globals.isomorphy || !window.globals.showIntersections
		});
		intersectionLayer.addChild(gapPath);
		var crossingPath = new Path({
			segments: segments2,
			strokeColor: window.globals.showIntersections ? (intersectionWatcher[1][i] ? 'red' : 'blue') : window.globals.strokeColor,
			strokeWidth: window.globals.strokeWidth,
			locked: true
		});
		intersectionLayer.addChild(crossingPath);
	}
}

globals.fromSnappy = function (geometry) {
	// Converts the link format from the Spherogram python package, as given in OrthogonalLinkDiagram.plink_data()
	// see https://github.com/3-manifolds/Spherogram/blob/master/spherogram_src/links/orthogonal.py
	var iso = globals.isomorphy;
	globals.isomorphy = false;
	globals.knotImported = true;
	this.switchIsomorphy();
	resetProject();

	var vertices = geometry[0];
	var arrows = geometry[1]; // Pairs (startVertex, endVertex), forming one cycle per link component
	var crossings = geometry[2]; // Tuples (underArrow, overArrow, ...)

	// Each vertex has exactly one outgoing arrow.
	var outgoingArrow = {};
	for (var i = 0; i < arrows.length; i++) {
		outgoingArrow[arrows[i][0]] = i;
	}

	// We walk the arrow cycles, building one closed path per component.
	// Segment p of a component's path corresponds to the p-th arrow walked,
	// so we record each arrow's encoded time for the crossing matching below.
	var arrowTime = {};
	var visited = {};
	for (var start = 0; start < vertices.length; start++) {
		if (visited[start]) continue;
		var componentIndex = knotList.length;
		var points = [];
		var v = start;
		var step = 0;
		while (!visited[v]) {
			visited[v] = true;
			points.push(new Point(vertices[v]));
			var arrow = outgoingArrow[v];
			arrowTime[arrow] = componentIndex * COMPONENT_OFFSET + step;
			v = arrows[arrow][1];
			step += 1;
		}
		knotList.push(new Path({
			segments: points,
			strokeColor: 'black',
			strokeWidth: window.globals.strokeWidth,
			closed: true,
			fullySelected: true
		}));
	}
	activeKnot = knotList[0];

	// Fit all components to the view with one common transformation.
	var bounds = knotList[0].bounds;
	for (var i = 1; i < knotList.length; i++) bounds = bounds.unite(knotList[i].bounds);
	var factor = 0.66 * Math.min(view.bounds.width / bounds.width, view.bounds.height / bounds.height);
	for (var i = 0; i < knotList.length; i++) {
		knotList[i].scale(factor, bounds.center);
		knotList[i].translate(view.center - bounds.center);
	}

	showIntersections({}); // Next, we let paperscript detect intersections.

	var intersectionIndices = []; // Lastly, we convert the intersection data.
	for (var j = 0; j < intersectionWatcher[2].length; j++) {
		intersectionIndices.push([Math.floor(intersectionWatcher[2][j]), Math.floor(intersectionWatcher[3][j])])
	}
	var used = {};
	for (var i = 0; i < crossings.length; i++) {
		var underTime = arrowTime[crossings[i][0]];
		var overTime = arrowTime[crossings[i][1]];

		for (var j = 0; j < intersectionIndices.length; j++) {
			if (used[j]) continue;
			if (intersectionIndices[j][0] == underTime && intersectionIndices[j][1] == overTime) {
				intersectionWatcher[1][j] = false; // The gap is drawn at the first location
				used[j] = true;
				break;
			}
			if (intersectionIndices[j][0] == overTime && intersectionIndices[j][1] == underTime) {
				intersectionWatcher[1][j] = true; // The gap is drawn at the second location
				used[j] = true;
				break;
			}
		}
	}

	showIntersections({ "skipMatching": true });
	if (knotList.length == 1) previousPolynomial = alexanderPolynomial(intersectionWatcher, activeKnot);
	typesetInvariants();
	pushUndo();
	globals.isomorphy = iso;
}


function hookeStep() {
	var l = intersectionWatcher[2].length;
	var eps = 0.5;
	for (var i = 0; i < l; i++) {
		var rawT11 = intersectionWatcher[2][i];
		var rawT12 = intersectionWatcher[3][i];
		var c11 = Math.floor(rawT11 / COMPONENT_OFFSET);
		var t11 = Math.floor(rawT11 % COMPONENT_OFFSET);
		var c12 = Math.floor(rawT12 / COMPONENT_OFFSET);
		var t12 = Math.floor(rawT12 % COMPONENT_OFFSET);

		for (var j = 0; j < l; j++) {
			if (i == j) { continue; }
			if (intersectionWatcher[0][i].getDistance(intersectionWatcher[0][j]) > 40) { continue; }

			var rawT21 = intersectionWatcher[2][j];
			var rawT22 = intersectionWatcher[3][j];
			var c21 = Math.floor(rawT21 / COMPONENT_OFFSET);
			var t21 = Math.floor(rawT21 % COMPONENT_OFFSET);
			var c22 = Math.floor(rawT22 / COMPONENT_OFFSET);
			var t22 = Math.floor(rawT22 % COMPONENT_OFFSET);

			var mindist = 4;

			function move(c, t, dir) {
				if (knotList[c] && knotList[c].segments[t]) {
					knotList[c].segments[t].point += dir;
					knotList[c].segments[t].next.point += dir;
				}
			}

			if (c11 == c21 && Math.abs(t11 - t21) < mindist) {
				normal = (intersectionWatcher[0][i] - intersectionWatcher[0][j]) / 50
				dir = normal * eps / (normal.length * normal.length);
				move(c12, t12, dir);
				move(c22, t22, -dir);
			}
			if (c12 == c21 && Math.abs(t12 - t21) < mindist) {
				normal = -(intersectionWatcher[0][i] - intersectionWatcher[0][j]) / 50
				dir = normal * eps / (normal.length * normal.length);
				move(c11, t11, dir);
				move(c22, t22, -dir);
			}
			if (c11 == c22 && Math.abs(t11 - t22) < mindist) {
				normal = (intersectionWatcher[0][i] - intersectionWatcher[0][j]) / 50
				dir = normal * eps / (normal.length * normal.length);
				move(c12, t12, dir);
				move(c21, t21, -dir);
			}
			if (c12 == c22 && Math.abs(t12 - t22) < 4) {
				normal = -(intersectionWatcher[0][i] - intersectionWatcher[0][j]) / 50
				dir = normal * eps / (normal.length * normal.length);
				move(c11, t11, dir);
				move(c21, t21, -dir);
			}
		}
	}

	// Smoothing step for all knots
	var eps = 0.1;
	for (var k = 0; k < knotList.length; k++) {
		var currentKnot = knotList[k];
		var l = currentKnot.segments.length;
		var deltas = [];
		for (var i = 0; i < l; i++) {
			var seg = currentKnot.segments[i];
			var delta = (seg.previous.point + seg.next.point - seg.point * 2) * eps;
			deltas.push(delta);
		}
		for (var i = 0; i < l; i++) {
			currentKnot.segments[i].point += deltas[i];
		}
	}
}

function linkingNumberString() {
	// Pairwise linking numbers: half the sum of crossing signs between two components.
	// A crossing is positive when the under strand points to the left of the over
	// strand (the y-axis points down, flipping the sign of the cross product).
	var sums = {};
	for (var i = 0; i < intersections.length; i++) {
		var loc1 = intersections[i];
		var loc2 = intersections[i].intersection;
		var c1 = Math.floor(getTime(loc1) / COMPONENT_OFFSET);
		var c2 = Math.floor(getTime(loc2) / COMPONENT_OFFSET);
		if (c1 == c2) continue;

		var over = intersectionWatcher[1][i] ? loc2 : loc1;
		var under = intersectionWatcher[1][i] ? loc1 : loc2;
		var sign = over.tangent.cross(under.tangent) < 0 ? 1 : -1;

		var key = Math.min(c1, c2) + "," + Math.max(c1, c2);
		sums[key] = (sums[key] || 0) + sign;
	}

	var out = [];
	for (var a = 0; a < knotList.length; a++) {
		for (var b = a + 1; b < knotList.length; b++) {
			var lk = (sums[a + "," + b] || 0) / 2;
			if (knotList.length == 2) return lk.toString();
			out.push("lk(" + (a + 1) + "," + (b + 1) + ") = " + lk);
		}
	}
	return out.join(", ");
}

function typesetInvariants() { // Prints the Alexander polynomial and detects when it was changed.
	if (knotList.length > 1) {
		showIntersections({});
		gauss.innerHTML = gaussCodeLink(intersectionWatcher, COMPONENT_OFFSET, knotList.length);
		dt.innerHTML = "Only available for knots";
		polynomial.innerHTML = "Only available for knots";
		linkingContainer.style.display = "block";
		linking.innerHTML = linkingNumberString();
		candidates.innerHTML = "";
		candidates_p.style.visibility = "hidden";
		// Disable isomorphy checks for links for now
		discreteMove = false;
		previousPolynomial = null;
		previousGaussCode = [];
		return;
	}
	linkingContainer.style.display = "none";

	gC = gaussCode(intersectionWatcher);

	var isGaussChanged = false;
	if (gC.length !== previousGaussCode.length) {
		isGaussChanged = true;
	} else {
		for (var i = 0; i < gC.length; i++) {
			if (gC[i] !== previousGaussCode[i]) {
				isGaussChanged = true;
			}
		}
	}
	if (globals.isomorphy && discreteMove && isGaussChanged) {
		setLog("Isotopy could not be guaranteed after that discrete move.");
	}
	discreteMove = false;
	gauss.innerHTML = gaussCode(intersectionWatcher);
	dt.innerHTML = dowkerThistlethwaiteCode(intersectionWatcher).toString();

	showIntersections({});
	var p = alexanderPolynomial(intersectionWatcher, activeKnot);
	polynomial.innerHTML = alexanderString(p);
	if (globals.isomorphy) {
		if (previousPolynomial == null || globals.knotImported) {
		} else if (polyToInt(p).value != polyToInt(previousPolynomial).value) {
			console.log(p, previousPolynomial);
			previousPolynomial = null;
			if (undoStack.length > 0) globals.fromJSON(undoStack.pop());
			setLog("Illegal move detected! Reverting...");
		}
	}

	globals.knotImported = false;
	previousPolynomial = p;
	previousGaussCode = gC;
	candidates.innerHTML = "";
	candidates_p.style.visibility = "hidden";
	var entry = knotEncyclopedia[p]
	if (entry !== undefined) {
		var candidateArray = entry[0];
		for (var k = 0; k < candidateArray.length; k++) {
			var knot = candidateArray[k];
			candidates_p.style.visibility = "visible";
			candidates.innerHTML += "<a target='_blank' rel='noreferrer noopener' href='http://katlas.org/wiki/" + knot + "'> <img height='50px' src='https://fi-le.net/knottingham/images/" + knot + ".gif'> </a>";
		}
	}

	if (window.MathJax) { MathJax.typeset(); }
}

// Now, the user interaction:
var segment, path, handle, handleIn;
var movePath = false;
var discreteMove = false; // This variable records discreet actions to alert when isotopy is not guaranteed.
var drawn;
var selectedEnd = false;
function onMouseDown(event) {
	if (drawing) {
		drawn = new Path({
			segments: [event.point],
			strokeColor: 'black',
			strokeWidth: window.globals.strokeWidth,
			fullySelected: true
		});

		// Ensure intersectionLayer exists if it was wiped
		if (!intersectionLayer || !project.layers.includes(intersectionLayer)) {
			intersectionLayer = new Layer();
			// Move drawn to the first layer
			if (project.layers.length > 1) {
				project.layers[0].addChild(drawn);
				project.layers[0].activate();
			}
		}

		return;
	}

	pushUndo();
	lastMousePosition = event.point;

	segment = handleIn = handle = null;
	var hitResult = project.hitTest(event.point, hitOptions);

	if (!hitResult) { // A click onto the blank canvas, we (de)select all components
		var bool = !activeKnot.selected;
		for (var i = 0; i < knotList.length; i++) knotList[i].selected = bool;
		hitOptions.handles = false;
		return;
	}

	if (event.modifiers.shift && !(hitResult.item.data.kind == 'intersection')) { // Shift+Click removes a segment
		if (hitResult.type == 'segment') {
			discreteMove = true;
			var s = hitResult.segment;
			var index = s.index;
			var cIdx = knotList.indexOf(s.path);
			if (cIdx == -1) cIdx = 0;

			for (var i = 0; i < intersectionWatcher[2].length; i++) {
				if (Math.floor(intersectionWatcher[2][i] / COMPONENT_OFFSET) == cIdx && intersectionWatcher[2][i] % COMPONENT_OFFSET >= index) {
					intersectionWatcher[2][i] -= 1;
				}
				if (Math.floor(intersectionWatcher[3][i] / COMPONENT_OFFSET) == cIdx && intersectionWatcher[3][i] % COMPONENT_OFFSET >= index) {
					intersectionWatcher[3][i] -= 1;
				}
			}

			s.remove();
		}
		return;
	}

	if (event.modifiers.control) { // Control+Click smooths a segment
		if (hitResult.type == 'segment') {
			discreteMove = true;
			var seg = hitResult.segment;
			seg.handleIn = (seg.previous.point - seg.next.point) / 4;
			seg.handleOut = -seg.handleIn;
		}
	}

	selectedEnd = false;
	if (hitResult) {
		if (hitResult.item.data.kind == 'intersection') {
			activeKnot = hitResult.item.data.path;
			var i = hitResult.item.data.i1;
			intersectionWatcher[1][i] = !(intersectionWatcher[1][i]);
		} else if (hitResult.type == 'segment') {
			activeKnot = hitResult.item;
			segment = hitResult.segment;
			activeKnot.selected = true;
			selectedEnd = segment.index == 0;
		} else if (hitResult.type == 'stroke') {
			activeKnot = hitResult.item;
			var index = hitResult.location._segment1.index;
			var cIdx = knotList.indexOf(activeKnot);
			if (cIdx == -1) cIdx = 0;
			activeKnot.selected = true;
			segment = activeKnot.insert(index + 1, event.point);
			for (var i = 0; i < intersectionWatcher[2].length; i++) {
				if (Math.floor(intersectionWatcher[2][i] / COMPONENT_OFFSET) == cIdx && intersectionWatcher[2][i] % COMPONENT_OFFSET >= index) {
					intersectionWatcher[2][i] += 1;
				}
				if (Math.floor(intersectionWatcher[3][i] / COMPONENT_OFFSET) == cIdx && intersectionWatcher[3][i] % COMPONENT_OFFSET >= index) {
					intersectionWatcher[3][i] += 1;
				}
			}
		} else if (hitResult.type == 'handle-in') {
			segment = hitResult.segment;
			handle = true;
			handleIn = true;
		}
		else if (hitResult.type == 'handle-out') {
			segment = hitResult.segment;
			handle = true;
			handleIn = false;
		}
	}

	showIntersections({});
}

function onMouseUp(event) {
	if (drawing) { // We are finished drawing.
		if (globals.smooth) { drawn.simplify(); }
		drawn.simplify(15);
		drawn.fullySelected = true;
		drawn.closed = true;
		drawing = false;

		activeKnot = drawn.clone();
		knotList.push(activeKnot);
		drawn.remove();
		showIntersections({});
		pushUndo();
		lastMousePosition = event.point;
	} else {
		if (globals.smooth) activeKnot.smooth({ type: 'catmull-rom', factor: 0.5 });
	}
	typesetInvariants();
}

function onMouseDrag(event) {
	if (drawing) { // We are currently drawing.
		drawn.add(event.point);
		return;
	}
	var SAVE_THRESHOLD = 25;
	if (event.point.getDistance(lastMousePosition) > SAVE_THRESHOLD) {
		pushUndo();
		lastMousePosition = event.point;
	}

	MAX_CURSOR_SPEED = 5;
	if (handle && handleIn) {
		var delta = event.point - segment.point - segment.handleIn;
	} else if (handle && !handleIn) {
		var delta = event.point - segment.point - segment.handleOut;
	} else if (segment) {
		var delta = event.point - segment.point;
	} if (!delta) { return; }
	if (globals.isomorphy) {
		delta = delta / Math.max(1, delta.length / MAX_CURSOR_SPEED);
	}


	if (handle) {
		if (handleIn) {
			segment.handleIn += delta;
			if (!globals.independentHandles) { segment.handleOut -= delta; }
		} else {
			segment.handleOut += delta;
			if (!globals.independentHandles) { segment.handleIn -= delta; }
		}
	} else if (segment) {
		segment.point += delta;

		var next = segment;
		var previous = segment;
		for (var i = 0; i < window.globals.neighbors; i++) {
			next = next.next;

			delta *= 0.5;
			previous = previous.previous;
			next.point += delta;
			previous.point += delta;
		}
	}

	showIntersections({});
	typesetInvariants();

}
typesetInvariants()

var speed = 10;
var angularSpeed = 3;
function onKeyDown(event) {
	var delta = new Point(0, 0);
	if (event.key == 'a') {
		delta.x -= speed;
	} else if (event.key == 'd') {
		delta.x += speed;
	}

	if (event.key == 'w') {
		delta.y -= speed;
	} else if (event.key == 's') {
		delta.y += speed;
	}
	activeKnot.translate(delta);

	if (event.key == 'e') {
		activeKnot.rotate(angularSpeed);
	} else if (event.key == 'q') {
		activeKnot.rotate(-angularSpeed);
	} else if (event.key == 'm') {
		globals.reflect();
	} else if (event.key == 'h') {
		hookeStep();
	}

	if (event.key == 'z') { // Ctrl+z seems impossible to catch?
		popUndo();
	}

	showIntersections({});
}
