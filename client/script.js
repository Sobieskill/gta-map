const socket = io()

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3
})

const bounds = [[0,0],[1000,1000]]

L.imageOverlay('map.jpg', bounds).addTo(map)
map.fitBounds(bounds)

const drawnItems = new L.FeatureGroup()
const markersLayer = new L.FeatureGroup()

map.addLayer(drawnItems)
map.addLayer(markersLayer)

let currentMode = 'territory'
let selectedLayer = null
let selectedPoint = null
let activeLocks = {}
let loadingLive = false

const sidebar = document.getElementById('sidebar')
const contextMenu = document.getElementById('contextMenu')
const onlineCount = document.getElementById('onlineCount')

const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems
  },

  draw: {
    polygon: true,
    rectangle: false,
    circle: false,
    polyline: false,
    marker: false,
    circlemarker: false
  }
})

map.addControl(drawControl)

function setAccent(color) {
  document.documentElement.style.setProperty('--accent', color)
}

function getPayload() {

  const territories = []

  drawnItems.eachLayer(layer => {

    territories.push({
      latlngs: layer.getLatLngs(),
      territoryData: layer.territoryData
    })
  })

  const markers = []

  markersLayer.eachLayer(marker => {

    markers.push({
      latlng: marker.getLatLng(),
      color: marker.customColor,
      description: marker.description
    })
  })

  return {
    territories,
    markers
  }
}

async function saveData() {

  const payload = getPayload()

  await fetch('/territories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
}

function broadcastLive() {

  socket.emit('live-update', getPayload())
}

function clearMap() {

  drawnItems.clearLayers()
  markersLayer.clearLayers()

  map.eachLayer(layer => {

    if (
      layer instanceof L.Marker
      &&
      layer.options.icon
      &&
      layer.options.icon.options.className === 'territory-logo'
    ) {
      map.removeLayer(layer)
    }
  })
}

async function loadData(payload = null) {

  loadingLive = true

  clearMap()

  const saved = payload || await fetch('/territories').then(r => r.json())

  if (saved.territories) {

    saved.territories.forEach(item => {

      const polygon = L.polygon(item.latlngs, {
        color: item.territoryData.color,
        fillColor: item.territoryData.color,
        fillOpacity: .35,
        weight: 3
      })

      polygon.territoryData = item.territoryData

      addLayerEvents(polygon)

      drawnItems.addLayer(polygon)

      createTerritoryLogo(polygon)
    })
  }

  if (saved.markers) {

    saved.markers.forEach(m => {

      createMarker(m.latlng, m.color, m.description)
    })
  }

  setTimeout(() => {
    loadingLive = false
  }, 300)
}

function createTerritoryLogo(layer) {

  if (!layer.territoryData.logo) return

  const center = layer.getBounds().getCenter()

  const icon = L.divIcon({
    className: 'territory-logo',
    html: `<img src="${layer.territoryData.logo}" class="territory-logo-img">`,
    iconSize: [80,80],
    iconAnchor: [40,40]
  })

  const marker = L.marker(center, {
    icon,
    interactive: false
  }).addTo(map)

  layer.logoMarker = marker
}

function addLayerEvents(layer) {

  layer.on('click', () => {

    selectedLayer = layer

    openSidebar(layer)
  })
}

function openSidebar(layer) {

  const data = layer.territoryData

  sidebar.classList.add('active')

  document.getElementById('territoryTitle').innerText = data.name
  document.getElementById('nameInput').value = data.name
  document.getElementById('descInput').value = data.description
  document.getElementById('statusInput').value = data.status
  document.getElementById('colorInput').value = data.color
  document.getElementById('statusBadge').innerText = data.status.toUpperCase()

  setAccent(data.color)

  renderGallery(data.images || [])
  renderLogo(data.logo)
}

function renderLogo(src) {

  const preview = document.getElementById('logoPreview')
  const small = document.getElementById('territoryLogoSmall')

  preview.innerHTML = ''
  small.innerHTML = ''

  if (!src) return

  preview.innerHTML = `<img src="${src}">`
  small.innerHTML = `<img src="${src}">`
}

function renderGallery(images) {

  const gallery =
    document.getElementById(
      'gallery'
    )

  gallery.innerHTML = ''

  images.forEach(
    (img, index) => {

      const div =
        document.createElement(
          'div'
        )

      div.className =
        'gallery-item'

      div.innerHTML = `
        <img
          src="${img}"
          onclick="showImageModal('${img}')"
        />

        <button
          class="remove-image"
          onclick="removeImage(${index})"
        >
          ✕
        </button>
      `

      gallery.appendChild(div)
    }
  )
}

function createMarker(
  latlng,
  color,
  description
) {

  const marker =
    L.circleMarker(latlng, {
      radius: 10,
      color,
      fillColor: color,
      fillOpacity: 1
    })

  marker.customColor = color
  marker.description = description || ''

  marker.bindTooltip(
    marker.description || 'POINT',
    {
      permanent: true,
      direction: 'top',
      offset: [0, -12],
      className: 'marker-label'
    }
  )

  marker.on('click', () => {

  selectedPoint = marker

  const modal =
    document.getElementById(
      'pointEditor'
    )

  const textarea =
    document.getElementById(
      'pointEditorText'
    )

  modal.style.display = 'flex'

  textarea.value =
    marker.description || ''

  document.getElementById(
    'savePointBtn'
  ).onclick = () => {

    marker.description =
      textarea.value

    marker.setTooltipContent(
      textarea.value || 'POINT'
    )

    modal.style.display = 'none'

    broadcastLive()
  }

  document.getElementById(
    'deletePointBtn'
  ).onclick = () => {

    markersLayer.removeLayer(
      marker
    )

    modal.style.display = 'none'

    broadcastLive()
  }

  document.getElementById(
    'closePointBtn'
  ).onclick = () => {

    modal.style.display = 'none'
  }
})

  marker.addTo(markersLayer)
}

map.on(L.Draw.Event.CREATED, e => {

  if (currentMode !== 'territory') return

  const layer = e.layer

  layer.territoryData = {
    id: crypto.randomUUID(),
    name: 'New Territory',
    description: '',
    status: 'neutral',
    color: '#d4af37',
    logo: null,
    images: []
  }

  layer.setStyle({
    color: '#d4af37',
    fillColor: '#d4af37',
    fillOpacity: .35,
    weight: 3
  })

  addLayerEvents(layer)

  drawnItems.addLayer(layer)

  broadcastLive()
})

map.on('click', e => {

  if (currentMode !== 'marker') return

  const pointName = prompt('Nazwa punktu')

  if (!pointName) return

  createMarker(
    e.latlng,
    document.getElementById('pointColorPicker').value,
    pointName
  )

  broadcastLive()
})

document.getElementById('saveBtn').onclick = async () => {

  await saveData()

  alert('Zapisano poprawnie')
}

document.getElementById('clearBtn').onclick = async () => {

  const confirmed = confirm(
    'Usunąć wszystko z mapy?'
  )

  if (!confirmed) return

  drawnItems.clearLayers()
  markersLayer.clearLayers()

  sidebar.classList.remove(
    'active'
  )

  selectedLayer = null

  await fetch('/territories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      territories: [],
      markers: []
    })
  })

  broadcastLive()
}

document.getElementById('territoryModeBtn').onclick = () => {
  currentMode = 'territory'
}

document.getElementById('markerModeBtn').onclick = () => {
  currentMode = 'marker'
}

document.getElementById('nameInput').oninput = e => {

  if (!selectedLayer || loadingLive) return

  selectedLayer.territoryData.name = e.target.value

  document.getElementById('territoryTitle').innerText = e.target.value

  broadcastLive()
}

document.getElementById('descInput').oninput = e => {

  if (!selectedLayer || loadingLive) return

  selectedLayer.territoryData.description = e.target.value

  broadcastLive()
}

document.getElementById('statusInput').onchange = e => {

  if (!selectedLayer || loadingLive) return

  selectedLayer.territoryData.status = e.target.value

  document.getElementById('statusBadge').innerText = e.target.value.toUpperCase()

  broadcastLive()
}

document.getElementById('colorInput').oninput = e => {

  if (!selectedLayer || loadingLive) return

  selectedLayer.territoryData.color = e.target.value

  selectedLayer.setStyle({
    color: e.target.value,
    fillColor: e.target.value
  })

  setAccent(e.target.value)

  broadcastLive()
}

document.getElementById('logoInput').onchange = async e => {

  if (!selectedLayer) return

  const file = e.target.files[0]

  const formData = new FormData()

  formData.append('file', file)

  const res = await fetch('/upload', {
    method: 'POST',
    body: formData
  })

  const data = await res.json()

  selectedLayer.territoryData.logo = data.path

  if (selectedLayer.logoMarker) {
    map.removeLayer(selectedLayer.logoMarker)
  }

  createTerritoryLogo(selectedLayer)

  renderLogo(data.path)

  broadcastLive()
}

document.getElementById('imageInput').onchange = async e => {

  if (!selectedLayer) return

  const files = e.target.files

  for (const file of files) {

    const formData = new FormData()

    formData.append('file', file)

    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()

    selectedLayer.territoryData.images.push(data.path)
  }

  renderGallery(selectedLayer.territoryData.images)

  broadcastLive()
}

document.getElementById('savePointBtn').onclick = () => {

  if (!selectedPoint) return

  const value = document.getElementById('pointEditorText').value

  selectedPoint.description = value

  selectedPoint.setTooltipContent(value)

  document.getElementById('pointEditor').style.display = 'none'

  broadcastLive()
}

document.getElementById('closePointBtn').onclick = () => {

  document.getElementById('pointEditor').style.display = 'none'
}

socket.on('live-update', payload => {

  loadData(payload)
})

socket.on('users-update', users => {

  if (onlineCount) {
    onlineCount.innerText = users.length
  }
})

function showImageModal(src) {

  const modal =
    document.getElementById(
      'imageModal'
    )

  const image =
    document.getElementById(
      'modalImage'
    )

  modal.style.display = 'flex'

  image.src = src
}

document
  .getElementById(
    'closeModal'
  )
  .onclick = () => {

    document
      .getElementById(
        'imageModal'
      )
      .style.display = 'none'
  }

loadData()

document.getElementById(
  'deleteBtn'
).onclick = () => {

  if (!selectedLayer) return

  if (
    selectedLayer.logoMarker
  ) {
    map.removeLayer(
      selectedLayer.logoMarker
    )
  }

  drawnItems.removeLayer(
    selectedLayer
  )

  sidebar.classList.remove(
    'active'
  )

  selectedLayer = null

  broadcastLive()
}

document.getElementById(
  'clearBtn'
).onclick = async () => {

  const confirmed = confirm(
    'Usunąć wszystko z mapy?'
  )

  if (!confirmed) return

  drawnItems.clearLayers()
  markersLayer.clearLayers()

  sidebar.classList.remove(
    'active'
  )

  selectedLayer = null

  await fetch('/territories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      territories: [],
      markers: []
    })
  })

  broadcastLive()
}

function showImageModal(src) {

  const modal =
    document.getElementById(
      'imageModal'
    )

  const image =
    document.getElementById(
      'modalImage'
    )

  modal.style.display = 'flex'

  image.src = src
}

document.getElementById(
  'closeModal'
).onclick = () => {

  document.getElementById(
    'imageModal'
  ).style.display = 'none'
}
function removeImage(index) {

  if (!selectedLayer) return

  if (
    !selectedLayer.territoryData.images
  ) return

  selectedLayer
    .territoryData
    .images
    .splice(index, 1)

  renderGallery(
    selectedLayer
      .territoryData
      .images
  )

  broadcastLive()
}