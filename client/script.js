const usersBox = document.createElement('div')

usersBox.className = 'users-online'

document.body.appendChild(usersBox)



// ========================================
// SOCKET
// ========================================

const socket = io()

// ========================================
// MAP
// ========================================

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3
})

const bounds = [
  [0, 0],
  [1000, 1000]
]

L.imageOverlay(
  'map.jpg',
  bounds
).addTo(map)

map.fitBounds(bounds)

// ========================================
// LAYERS
// ========================================

const drawnItems = new L.FeatureGroup()
const markersLayer = new L.FeatureGroup()

map.addLayer(drawnItems)
map.addLayer(markersLayer)

// ========================================
// STATE
// ========================================

let currentMode = 'territory'
let selectedLayer = null
let selectedMarker = null
let activeLocks = {}
let onlineUsers = []
let saveTimeout = null
let loadingData = false

// ========================================
// ELEMENTS
// ========================================

const sidebar =
  document.getElementById('sidebar')

const contextMenu =
  document.getElementById('contextMenu')

const pointEditor =
  document.getElementById('pointEditor')

const pointEditorText =
  document.getElementById('pointEditorText')

// ========================================
// DRAW CONTROL
// ========================================

const drawControl =
  new L.Control.Draw({

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

// ========================================
// HELPERS
// ========================================

function setAccent(color) {

  document.documentElement
    .style
    .setProperty(
      '--accent',
      color
    )
}

function debounceSave() {

  if (loadingData)
    return

  clearTimeout(saveTimeout)

  saveTimeout = setTimeout(() => {
    saveData()
  }, 2000)
}

// ========================================
// SAVE
// ========================================

async function saveData() {

  if (loadingData) return

  const territories = []

  drawnItems.eachLayer(layer => {

    territories.push({

      latlngs:
        layer.getLatLngs(),

      territoryData:
        layer.territoryData
    })
  })

  const markers = []

  markersLayer.eachLayer(marker => {

    markers.push({

      latlng:
        marker.getLatLng(),

      color:
        marker.customColor,

      description:
  marker.customDescription
  || marker.description
    })
  })

  const payload = {
    territories,
    markers
  }

  try {

    await fetch('/territories', {

      method: 'POST',

      headers: {
        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify(payload)
    })

    socket.emit(
      'force-save',
      payload
    )

  } catch(err) {

    console.error(err)
  }
}

// ========================================
// CLEAR
// ========================================

function clearMap() {

  drawnItems.clearLayers()
  markersLayer.clearLayers()

  map.eachLayer(layer => {

    if (
      layer instanceof L.Marker
      &&
      layer.options.icon
      &&
      layer.options.icon.options
      &&
      layer.options.icon.options.className
      === 'territory-logo'
    ) {

      map.removeLayer(layer)
    }
  })
}

// ========================================
// LOAD
// ========================================

async function loadData() {

  try {

    loadingData = true

    clearMap()

    const res =
      await fetch('/territories')

    const saved =
      await res.json()

    // ====================
    // TERRITORIES
    // ====================

    if (saved.territories) {

      saved.territories.forEach(item => {

        const polygon =
          L.polygon(
            item.latlngs,
            {
              color:
                item.territoryData.color,

              fillColor:
                item.territoryData.color,

              fillOpacity: .35,

              weight: 3
            }
          )

        polygon.territoryData =
          item.territoryData

        addLayerEvents(
          polygon
        )

        drawnItems.addLayer(
          polygon
        )

        createTerritoryLogo(
          polygon
        )
      })
    }

    // ====================
    // MARKERS
    // ====================

    if (saved.markers) {

      saved.markers.forEach(marker => {

        createMarker(
          marker.latlng,
          marker.color,
          marker.description
        )
      })
    }

    loadingData = false

  } catch(err) {

    console.error(err)

    loadingData = false
  }
}

// ========================================
// LOGO
// ========================================

function createTerritoryLogo(layer) {

  if (
    !layer.territoryData.logo
  ) return

  const center =
    layer.getBounds().getCenter()

  const icon = L.divIcon({

    className:
      'territory-logo',

    html: `
      <img
        src="${layer.territoryData.logo}"
        class="territory-logo-img"
      />
    `,

    iconSize:[80,80]
  })

  const marker =
    L.marker(
      center,
      { icon }
    )

  marker.addTo(map)

  layer.logoMarker =
    marker
}

// ========================================
// EVENTS
// ========================================

function addLayerEvents(layer) {

  layer.on('click', () => {

    selectedLayer = layer

    openSidebar(layer)
  })

  layer.on(
    'contextmenu',
    e => {

      selectedLayer = layer

      contextMenu.style.display =
        'block'

      contextMenu.style.left =
        e.originalEvent.pageX
        + 'px'

      contextMenu.style.top =
        e.originalEvent.pageY
        + 'px'
    }
  )
}

// ========================================
// SIDEBAR
// ========================================

function openSidebar(layer) {

  const data =
    layer.territoryData

  sidebar.classList.add(
    'active'
  )

  setAccent(
    data.color
  )

  document.getElementById(
    'territoryTitle'
  ).innerText =
    data.name

  document.getElementById(
    'nameInput'
  ).value =
    data.name

  document.getElementById(
    'descInput'
  ).value =
    data.description

  document.getElementById(
    'statusInput'
  ).value =
    data.status

  document.getElementById(
    'colorInput'
  ).value =
    data.color

  renderGallery(
    data.images || []
  )

  renderLogo(
    data.logo
  )
}

// ========================================
// GALLERY
// ========================================

function renderGallery(images) {

  const gallery =
    document.getElementById(
      'gallery'
    )

  gallery.innerHTML = ''

  images.forEach((img,index) => {

    const div =
      document.createElement('div')

    div.className =
      'gallery-item'

    div.innerHTML = `
      <img
        src="${img}"
      />

      <button
        class="remove-image"
        onclick="removeImage(${index})"
      >
        X
      </button>
    `

    gallery.appendChild(div)
  })
}

function renderLogo(src) {

  const preview =
    document.getElementById(
      'logoPreview'
    )

  const small =
    document.getElementById(
      'territoryLogoSmall'
    )

  preview.innerHTML = ''
  small.innerHTML = ''

  if (!src) return

  preview.innerHTML = `
    <img src="${src}" />
  `

  small.innerHTML = `
    <img src="${src}" />
  `
}
document
  .getElementById(
    'imageInput'
  )
  .onchange = e => {

    if (!selectedLayer)
      return

    const files = e.target.files

    for (let file of files) {

      const reader =
        new FileReader()

      reader.onload =
        event => {

          if (
            !selectedLayer
              .territoryData
              .images
          ) {

            selectedLayer
              .territoryData
              .images = []
          }

          selectedLayer
            .territoryData
            .images
            .push(
              event.target.result
            )

          renderGallery(
            selectedLayer
              .territoryData
              .images
          )

          debounceSave()
        }

      reader.readAsDataURL(
        file
      )
    }
  }

// ========================================
// REMOVE IMAGE
// ========================================

function removeImage(index) {

  if (!selectedLayer) return

  selectedLayer
    .territoryData
    .images
    .splice(index,1)

  renderGallery(
    selectedLayer
      .territoryData
      .images
  )

  debounceSave()
}

// ========================================
// CREATE TERRITORY
// ========================================

map.on(
  L.Draw.Event.CREATED,

  e => {

    if (
      currentMode
      !== 'territory'
    ) return

    const layer =
      e.layer

    layer.territoryData = {

      id:
        crypto.randomUUID(),

      name:
        'New Territory',

      description:
        '',

      status:
        'neutral',

      color:
        '#d4af37',

      logo:
        null,

      images:[]
    }

    layer.setStyle({

      color:'#d4af37',

      fillColor:'#d4af37',

      fillOpacity:.35,

      weight:3
    })

    addLayerEvents(layer)

    drawnItems.addLayer(layer)

    debounceSave()
  }
)

// ========================================
// MARKERS
// ========================================

function createMarker(
  latlng,
  color,
  description
) {

  const marker =
    L.circleMarker(
      latlng,
      {
        radius:10,
        color,
        fillColor:color,
        fillOpacity:1
      }
    )

  marker.customColor =
    color

  marker.description =
    description || ''

  marker.bindTooltip(
    description || 'POINT',
    {
      permanent:true,
      direction:'top',
      offset:[0,-12],
      className:
        'marker-label'
    }
  )

  marker.on('click', () => {

    selectedMarker = marker

    pointEditor.style.display =
      'flex'

    pointEditorText.value =
      marker.description
  })

  marker.on(
    'contextmenu',
    () => {

      if (
        confirm(
          'Usunąć punkt?'
        )
      ) {

        markersLayer.removeLayer(
          marker
        )

        debounceSave()
      }
    }
  )

  marker.addTo(markersLayer)
}

// ========================================
// MAP CLICK
// ========================================

map.on('click', e => {

  contextMenu.style.display =
    'none'

  if (
    currentMode
    === 'marker'
  ) {

    const color =
      document
        .getElementById(
          'pointColorPicker'
        )
        .value

    createMarker(
      e.latlng,
      color,
      'NEW POINT'
    )

    debounceSave()
  }
})

// ========================================
// POINT EDITOR
// ========================================

document.getElementById(
  'savePointBtn'
).onclick = () => {

  if (!selectedMarker)
    return

  selectedMarker.description =
    pointEditorText.value

  selectedMarker.setTooltipContent(
    pointEditorText.value
  )
  selectedMarker.customDescription =
  pointEditorText.value

  pointEditor.style.display =
    'none'

  debounceSave()
}

document.getElementById(
  'deletePointBtn'
).onclick = () => {

  if (!selectedMarker)
    return

  markersLayer.removeLayer(
    selectedMarker
  )

  pointEditor.style.display =
    'none'

  debounceSave()
}

document.getElementById(
  'closePointBtn'
).onclick = () => {

  pointEditor.style.display =
    'none'
}

// ========================================
// MODES
// ========================================

document.getElementById(
  'territoryModeBtn'
).onclick = () => {

  currentMode =
    'territory'
}

document.getElementById(
  'markerModeBtn'
).onclick = () => {

  currentMode =
    'marker'
}

// ========================================
// INPUTS
// ========================================

document.getElementById(
  'nameInput'
).oninput = e => {

  if (!selectedLayer)
    return

  selectedLayer
    .territoryData
    .name =
      e.target.value

  document.getElementById(
    'territoryTitle'
  ).innerText =
    e.target.value

  debounceSave()
}

document.getElementById(
  'descInput'
).oninput = e => {

  if (!selectedLayer)
    return

  selectedLayer
    .territoryData
    .description =
      e.target.value

  debounceSave()
}

document.getElementById(
  'statusInput'
).onchange = e => {

  if (!selectedLayer)
    return

  selectedLayer
    .territoryData
    .status =
      e.target.value

  debounceSave()
}

document.getElementById(
  'colorInput'
).oninput = e => {

  if (!selectedLayer)
    return

  selectedLayer
    .territoryData
    .color =
      e.target.value

  selectedLayer.setStyle({

    color:
      e.target.value,

    fillColor:
      e.target.value
  })

  setAccent(
    e.target.value
  )

  debounceSave()
}

// ========================================
// SAVE BTN
// ========================================

document.getElementById(
  'saveBtn'
).onclick = async () => {

  await saveData()

  alert('Zapisano')
}

// ========================================
// CLEAR BTN
// ========================================

document.getElementById(
  'clearBtn'
).onclick = async () => {

  if (
    !confirm(
      'Usunąć wszystko?'
    )
  ) return

  await fetch(
    '/territories',
    {
      method:'POST',

      headers:{
        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify({

          territories:[],
          markers:[]
        })
    }
  )

  location.reload()
}

// ========================================
// LIVE UPDATE
// ========================================

socket.on(
  'live-update',
  async () => {

    await loadData()
  }
)

// ========================================
// CURSORS
// ========================================

const cursorLayer = {}

document.addEventListener(
  'mousemove',
  e => {

    socket.emit(
      'cursor-move',
      {
        x:e.clientX,
        y:e.clientY
      }
    )
  }
)

socket.on(
  'cursor-update',
  data => {

    if (
      !cursorLayer[data.id]
    ) {

      const div =
        document.createElement(
          'div'
        )

      div.className =
        'online-cursor'

      document.body.appendChild(
        div
      )

      cursorLayer[data.id] =
        div
    }

    cursorLayer[data.id]
      .style.left =
        data.x + 'px'

    cursorLayer[data.id]
      .style.top =
        data.y + 'px'
  }
)

// ========================================
// ONLINE USERS
// ========================================

socket.on(
  'users-update',
  users => {

    onlineUsers = users

    usersBox.innerHTML = `
      ONLINE: ${users.length}
    `
  }
)

// ========================================
// START
// ========================================

loadData()