const socket = io()

// ======================
// STATE
// ======================

let currentMode = 'territory'
let selectedLayer = null
let selectedMarker = null
let loadingData = false
let saveTimeout = null

// ======================
// MAP
// ======================

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3
})

const bounds = [
  [0,0],
  [1000,1000]
]

L.imageOverlay(
  'map.jpg',
  bounds
).addTo(map)

map.fitBounds(bounds)

// ======================
// LAYERS
// ======================

const drawnItems =
  new L.FeatureGroup()

const markersLayer =
  new L.FeatureGroup()

map.addLayer(drawnItems)
map.addLayer(markersLayer)

// ======================
// DRAW
// ======================

const drawControl =
  new L.Control.Draw({

    edit:{
      featureGroup:
        drawnItems
    },

    draw:{
      polygon:true,

      rectangle:false,
      circle:false,
      polyline:false,
      marker:false,
      circlemarker:false
    }
  })

map.addControl(drawControl)

// ======================
// SAVE SYSTEM
// ======================

function autoSave() {

  clearTimeout(saveTimeout)

  saveTimeout =
    setTimeout(() => {

      saveData()

    }, 1500)
}

async function saveData() {

  if (loadingData)
    return

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
    })
  })

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
          territories,
          markers
        })
    }
  )
}

// ======================
// CLEAR MAP
// ======================

function clearMap() {

  drawnItems.clearLayers()
  markersLayer.clearLayers()

  map.eachLayer(layer => {

    if (
      layer.isTerritoryLogo
    ) {

      map.removeLayer(layer)
    }
  })
}

// ======================
// LOAD DATA
// ======================

async function loadData() {

  loadingData = true

  clearMap()

  const res =
    await fetch('/territories')

  const saved =
    await res.json()

  // ======================
  // TERRITORIES
  // ======================

  if (saved.territories) {

    saved.territories.forEach(item => {

      const polygon =
        L.polygon(
          item.latlngs,
          {
            color:
              item
              .territoryData
              .color,

            fillColor:
              item
              .territoryData
              .color,

            fillOpacity:.35,
            weight:3
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

  // ======================
  // MARKERS
  // ======================

  if (saved.markers) {

    saved.markers.forEach(m => {

      createMarker(
        m.latlng,
        m.color,
        m.description
      )
    })
  }

  loadingData = false
}

// ======================
// TERRITORY LOGO
// ======================

function createTerritoryLogo(layer) {

  if (
    !layer ||
    !layer.territoryData ||
    !layer.territoryData.logo
  ) return

  if (
    layer.logoMarker
  ) {

    map.removeLayer(
      layer.logoMarker
    )
  }

  const center =
    layer
      .getBounds()
      .getCenter()

  const marker =
    L.marker(
      center,
      {
        interactive:false,

        icon:
          L.divIcon({

            className:
              'territory-logo',

            html: `
              <img
                src="${layer.territoryData.logo}"
                class="territory-logo-img"
              />
            `,

            iconSize:[80,80],
            iconAnchor:[40,40]
          })
      }
    )

  marker.isTerritoryLogo =
    true

  marker.addTo(map)

  layer.logoMarker =
    marker
}

// ======================
// EVENTS
// ======================

function addLayerEvents(layer) {

  layer.on(
    'click',
    () => {

      selectedLayer =
        layer

      openSidebar(
        layer
      )
    }
  )
}

// ======================
// SIDEBAR
// ======================

function openSidebar(layer) {

  const data =
    layer.territoryData

  document
    .getElementById(
      'sidebar'
    )
    .classList
    .add('active')

  document
    .getElementById(
      'territoryTitle'
    )
    .innerText =
      data.name

  document
    .getElementById(
      'nameInput'
    )
    .value =
      data.name

  document
    .getElementById(
      'descInput'
    )
    .value =
      data.description

  document
    .getElementById(
      'statusInput'
    )
    .value =
      data.status

  document
    .getElementById(
      'colorInput'
    )
    .value =
      data.color

  document
    .getElementById(
      'statusBadge'
    )
    .innerText =
      data.status
        .toUpperCase()

  renderLogo(
    data.logo
  )

  renderGallery(
    data.images || []
  )
}

// ======================
// LOGO RENDER
// ======================

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

  if (!src)
    return

  preview.innerHTML =
    `<img src="${src}" />`

  small.innerHTML =
    `<img src="${src}" />`
}

// ======================
// GALLERY
// ======================

function renderGallery(images) {

  const gallery =
    document.getElementById(
      'gallery'
    )

  gallery.innerHTML = ''

  images.forEach(img => {

    const div =
      document.createElement(
        'div'
      )

    div.className =
      'gallery-item'

    div.innerHTML = `
      <img
        src="${img}"
        onclick="openImage('${img}')"
      />
    `

    gallery.appendChild(div)
  })
}

// ======================
// IMAGE MODAL
// ======================

function openImage(src) {

  document
    .getElementById(
      'imageModal'
    )
    .style
    .display =
      'flex'

  document
    .getElementById(
      'modalImage'
    )
    .src =
      src
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
      .style
      .display =
        'none'
  }

// ======================
// CREATE TERRITORY
// ======================

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

    addLayerEvents(
      layer
    )

    drawnItems.addLayer(
      layer
    )

    autoSave()
  }
)

// ======================
// MARKERS
// ======================

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

  marker.customDescription =
    description || ''

  marker.bindTooltip(
    description || 'POINT',
    {
      permanent:true,
      direction:'top'
    }
  )

  marker.on(
    'click',
    () => {

      selectedMarker =
        marker

      document
        .getElementById(
          'pointEditor'
        )
        .style
        .display =
          'flex'

      document
        .getElementById(
          'pointEditorText'
        )
        .value =
          marker.customDescription
    }
  )

  marker.addTo(
    markersLayer
  )
}

// ======================
// CREATE POINT
// ======================

map.on(
  'click',
  e => {

    if (
      currentMode
      !== 'marker'
    ) return

    const pointName =
      prompt(
        'Nazwa punktu:'
      )

    if (!pointName)
      return

    const color =
      document
        .getElementById(
          'pointColorPicker'
        )
        .value

    createMarker(
      e.latlng,
      color,
      pointName
    )

    autoSave()
  }
)

// ======================
// POINT SAVE
// ======================

document
  .getElementById(
    'savePointBtn'
  )
  .onclick = () => {

    if (!selectedMarker)
      return

    selectedMarker.customDescription =
      document
        .getElementById(
          'pointEditorText'
        )
        .value

    selectedMarker.setTooltipContent(
      selectedMarker.customDescription
    )

    document
      .getElementById(
        'pointEditor'
      )
      .style
      .display =
        'none'

    autoSave()
  }

// ======================
// INPUTS
// ======================

document
  .getElementById(
    'nameInput'
  )
  .oninput = e => {

    if (!selectedLayer)
      return

    selectedLayer
      .territoryData
      .name =
        e.target.value

    document
      .getElementById(
        'territoryTitle'
      )
      .innerText =
        e.target.value

    autoSave()
  }

document
  .getElementById(
    'descInput'
  )
  .oninput = e => {

    if (!selectedLayer)
      return

    selectedLayer
      .territoryData
      .description =
        e.target.value

    autoSave()
  }

document
  .getElementById(
    'statusInput'
  )
  .onchange = e => {

    if (!selectedLayer)
      return

    selectedLayer
      .territoryData
      .status =
        e.target.value

    document
      .getElementById(
        'statusBadge'
      )
      .innerText =
        e.target.value
          .toUpperCase()

    autoSave()
  }

document
  .getElementById(
    'colorInput'
  )
  .oninput = e => {

    if (!selectedLayer)
      return

    selectedLayer
      .territoryData
      .color =
        e.target.value

    selectedLayer.setStyle({

      color:e.target.value,
      fillColor:e.target.value
    })

    autoSave()
  }

// ======================
// LOGO
// ======================

document
  .getElementById(
    'logoInput'
  )
  .onchange = async e => {

    if (!selectedLayer)
      return

    const file =
      e.target.files[0]

    const formData =
      new FormData()

    formData.append(
      'file',
      file
    )

    const res =
      await fetch(
        '/upload',
        {
          method:'POST',
          body:formData
        }
      )

    const data =
      await res.json()

    selectedLayer
      .territoryData
      .logo =
        data.path

    createTerritoryLogo(
      selectedLayer
    )

    renderLogo(
      data.path
    )

    autoSave()
  }

// ======================
// IMAGES
// ======================

document
  .getElementById(
    'imageInput'
  )
  .onchange = async e => {

    if (!selectedLayer)
      return

    const files =
      Array.from(
        e.target.files
      )

    for (
      const file of files
    ) {

      const formData =
        new FormData()

      formData.append(
        'file',
        file
      )

      const res =
        await fetch(
          '/upload',
          {
            method:'POST',
            body:formData
          }
        )

      const data =
        await res.json()

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
          data.path
        )
    }

    renderGallery(
      selectedLayer
        .territoryData
        .images
    )

    autoSave()
  }

// ======================
// MODES
// ======================

document
  .getElementById(
    'territoryModeBtn'
  )
  .onclick = () => {

    currentMode =
      'territory'
  }

document
  .getElementById(
    'markerModeBtn'
  )
  .onclick = () => {

    currentMode =
      'marker'
  }

// ======================
// SAVE BUTTON
// ======================

document
  .getElementById(
    'saveBtn'
  )
  .onclick = () => {

    saveData()
  }

// ======================
// LIVE UPDATE
// ======================

socket.on(
  'map-updated',
  async () => {

    if (loadingData)
      return

    await loadData()
  }
)

// ======================
// START
// ======================

socket.on(
  'users-update',
  users => {

    const el =
      document.getElementById(
        'onlineCount'
      )

    if (el) {

      el.innerText =
        users.length
    }
  }
)

loadData()

