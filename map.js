const pubStravaToken = "57a2e0bbc8a2789e2a56cb2f911d76d6ce48b5e5";
const cross = "https://storage.googleapis.com/material-icons/external-assets/v4/icons/svg/ic_close_black_16px.svg"
const R = 6372.8*1000; // metres


let map;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 51.508235, lng: -0.324592},
    zoom: 16,
    styles: [
      {
        featureType: "all",
        elementType: "labels",
        stylers: [
          { visibility: "off" },
        ],
      },
    ],
  });
  const points = [];
  const onPoint = p => {
    if (p.lng > -0.316275) {
      return
    }

    points.push(p);
    new google.maps.Marker({
      position: p,
      map: map,
      icon: cross,
    });
  };

  const p1 = fetchCommutes("to_work")
    .then(x => x.map(j => j.id))
    .then(ids => {
      promises = [];
      for (const id of ids) {
        const prom = fetchActivity(id).then(x => {
          const p = x.stream[0].point;
          onPoint(p);
        });
      }
      return Promise.all(promises);
    });

  const p2 = fetchCommutes("from_work")
    .then(x => x.map(j => j.id))
    .then(ids => {
      promises = [];
      for (const id of ids) {
        const prom = fetchActivity(id).then(x => {
          const p = x.stream[x.stream.length-1].point;
          onPoint(p);
        });
      }
      return Promise.all(promises);
    });

  Promise.all([p1, p2])
    .then(() => {
      for (const p of points) {
        new google.maps.Marker({
          position: p,
          map: map,
          icon: cross,
        });
      }
      fitCircle(points)
    });
}

function makeGeoJson(stream) {
  return {
    type: "Feature",
    properties: {
      color: "blue",
    },
    geometry: {
      type: "LineString",
      coordinates: stream.map(s => [s.point.lng, s.point.lat]),
    }
  };
}


function fetchCommutes(direction) {
  const p = fetch("activities200.json")
    .then(x => x.json())

  if (direction === "to_work") {
    // get the morning commutes
    return p.then(acts => acts.filter(a => new Date(a.start_date).getHours() < 12))
  } else if (direction === "from_work") {
    // get the evening commutes
    return p.then(acts => acts.filter(a => new Date(a.start_date).getHours() >= 12))
  }
  return p
}

function fetchActivity(id) {
  return fetch("https://nene.strava.com/flyby/stream_compare/" + id + "/" + id)
    .then(x => x.json())
}

// from Rosetta Code
function haversine(p1, p2) {
  const lat1 = toRad(p1.lat);
  const lon1 = toRad(p1.lng);
  const lat2 = toRad(p2.lat);
  const lon2 = toRad(p2.lng);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) * Math.sin(dLat /2) + Math.sin(dLon / 2) * Math.sin(dLon /2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

function euclidean(p1, p2) {
  const lat1 = toRad(p1.lat);
  const lon1 = toRad(p1.lng);
  const lat2 = toRad(p2.lat);
  const lon2 = toRad(p2.lng);

  const x1 = R * Math.cos(lat1) * Math.cos(lon1);
  const y1 = R * Math.cos(lat1) * Math.sin(lon1);
  const z1 = R * Math.sin(lat1);

  const x2 = R * Math.cos(lat2) * Math.cos(lon2);
  const y2 = R * Math.cos(lat2) * Math.sin(lon2);
  const z2 = R * Math.sin(lat2);

  return Math.sqrt((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2)+(z1-z2)*(z1-z2));
}

function euclidean2(p1, p2) {
  const lat1 = toRad(p1.lat);
  const lon1 = toRad(p1.lng);
  const lat2 = toRad(p2.lat);
  const lon2 = toRad(p2.lng);

  return R * Math.sqrt(
    (lat2-lat1)*(lat2-lat1) +
    Math.cos((lat1+lat2)/2)*Math.cos((lat1+lat2)/2)*(lon2-lon1)*(lon2-lon1)
  );
}

function dEuclideandLat(p1, p2) {
  const lat1 = toRad(p1.lat);
  const lon1 = toRad(p1.lng);
  const lat2 = toRad(p2.lat);
  const lon2 = toRad(p2.lng);

  const d = (10+euclidean2(p1, p2))
  const r = R
  const rest = (-2*(lat2-lat1) - (lon2-lon1)*(lon2-lon1)*Math.cos((lat1+lat2)/2)*Math.sin((lat1+lat2)/2));
  return r / d * rest;
}

function dEuclideandLng(p1, p2) {
  const lat1 = toRad(p1.lat);
  const lon1 = toRad(p1.lng);
  const lat2 = toRad(p2.lat);
  const lon2 = toRad(p2.lng);


  return R / (1+ euclidean2(p1, p2)) * -2 *Math.cos((lat1+lat2)/2)*Math.cos((lat1+lat2)/2)*(lon2-lon1);
}

function toRad(deg) {
  return deg/180.0 * Math.PI;
}

function fitCircle(points) {

  let circ = {
    lat: average(points.map(p => p.lat)),
    lng: average(points.map(p => p.lng)),
  }
  circ.r = 500;

  addCircle(circ);

  const dJdLat = (circLat, circLng, circR, points) => {
    let cost = 0;
    for (const p of points) {
      const x = (euclidean2({lng: circLng, lat: circLat}, p) - circR);
      const foo = dEuclideandLat({lng: circLng, lat: circLat}, p);
      cost += x * foo;
    }
    return cost/points.length;
  }

  const dJdLng = (circLat, circLng, circR, points) => {
    let cost = 0;
    for (const p of points) {
      const x = (euclidean2({lng: circLng, lat: circLat}, p) - circR);
      cost += x * dEuclideandLng({lng: circLng, lat: circLat}, p);
    }
    return cost/points.length;
  }

  const dJdR = (circLat, circLng, circR, points) => {
    let cost = 0;
    for (const p of points) {
      const x = (euclidean2({lng: circLng, lat: circLat}, p) - circR);
      cost += x * -1;
    }
    return cost/points.length;
  }

  const a = 0.00001;

  for (let i = 0; i < 400; i++) {
    const newCirc = {
      lat: circ.lat - a*dJdLat(circ.lat, circ.lng, circ.r, points),
      lng: circ.lng - a*dJdLng(circ.lat, circ.lng, circ.r, points),
      r: circ.r - a*dJdR(circ.lat, circ.lng, circ.r, points),
    };
    circ = newCirc;
    addCircle(circ);
  }
}

function average(points) {
  total = 0;
  for (const p of points) {
    total += p;
  }
  return total / points.length;
}

let colour = 0;
function addCircle(c, col) {
  console.log("adding circle ", c);

  new google.maps.Circle({
    strokeColor: col || '#0000'+colour.toString(16),
    strokeOpacity: 0.2,
    strokeWeight: 1,
    // fillColor: '#0000'+colour.toString(16),
    fillOpacity: 0,
    map: map,
    center: {
      lat: c.lat,
      lng: c.lng,
    },
    radius: c.r,
  });
  new google.maps.Marker({
      position: {
        lat: c.lat,
        lng: c.lng,
      },
      map: map,
      icon: col ? null : cross,
    });
  colour += 1;
}
