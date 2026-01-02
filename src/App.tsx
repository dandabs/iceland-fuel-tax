import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

type VehicleType = 'Petrol/Diesel' | 'Electric'

// default efficiency by vehicle type (used to prefill efficiency when type changes)
const defaultEfficiency: Record<VehicleType, number> = {
  'Petrol/Diesel': 6.5,
  Electric: 18,
}

// default current price by vehicle type (fuel or electricity)
const defaultCurrentPrice: Record<VehicleType, number> = {
  'Petrol/Diesel': 185,
  Electric: 25.7,
}

// default past price by vehicle type (fuel or electricity with old tax)
const defaultPastPrice: Record<VehicleType, number> = {
  'Petrol/Diesel': 300,
  Electric: 25.7,
}

function formatISK(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-GB', { maximumFractionDigits: 0 }) + ' ISK'
}

function App() {
  const { t, i18n } = useTranslation()

  // Inputs
  const [vehicleType, setVehicleType] = useState<VehicleType>('Petrol/Diesel')
  const [distance, setDistance] = useState<number | ''>(15000)
  const [efficiency, setEfficiency] = useState<number | ''>(6.5) // L/100km or kWh/100km
  const [currentFuelPrice, setCurrentFuelPrice] = useState<number | ''>(185) // ISK per L or kWh
  const [pastFuelPrice, setPastFuelPrice] = useState<number | ''>(300) // ISK per L or kWh (historical)

  // Validation state
  const [errors, setErrors] = useState<string[]>([])

  // Graph expansion state
  const [isGraphExpanded, setIsGraphExpanded] = useState(false)
  const [isVehicleComparisonExpanded, setIsVehicleComparisonExpanded] = useState(false)
  const [isEfficiencyComparisonExpanded, setIsEfficiencyComparisonExpanded] = useState(false)

  // Computed breakdown/results
  const [computedBreakdown, setComputedBreakdown] = useState<{
    consumed: number
    previousEstimatedCost: number
    newFuelCost: number
    newTaxes: number
    newTotalCost: number
  } | null>(null)

  const efficiencyUnit = vehicleType === 'Electric' ? 'kWh/100km' : 'L/100km'
  const unitLabel = vehicleType === 'Electric' ? 'ISK / kWh' : 'ISK / L'

  function validateInputs() {
    const errs: string[] = []
    const priceLabel = vehicleType === 'Electric' ? 'electricity price' : 'fuel price'
    
    if (distance === '' || Number.isNaN(Number(distance))) errs.push('Annual distance is required')
    else if (distance < 0) errs.push('Distance cannot be negative')
    else if (distance > 1_000_000) errs.push('Distance seems unreasonably large')

    if (efficiency === '' || Number.isNaN(Number(efficiency))) errs.push('Efficiency is required')
    else if (efficiency <= 0) errs.push('Efficiency must be greater than 0')
    else if (efficiency > 1000) errs.push('Efficiency seems unreasonably large')

    if (currentFuelPrice === '' || Number.isNaN(Number(currentFuelPrice))) errs.push(`Current ${priceLabel} is required`)
    else if (currentFuelPrice < 0) errs.push(`Current ${priceLabel} cannot be negative`)
    else if (currentFuelPrice > 10000) errs.push(`Current ${priceLabel} seems unreasonably large`)

    if (pastFuelPrice === '' || Number.isNaN(Number(pastFuelPrice))) errs.push(`Past ${priceLabel} is required`)
    else if (pastFuelPrice < 0) errs.push(`Past ${priceLabel} cannot be negative`)
    else if (pastFuelPrice > 10000) errs.push(`Past ${priceLabel} seems unreasonably large`)

    setErrors(errs)
    return errs.length === 0
  }



  function handleCalculate() {
    if (!validateInputs()) return

    const d = Number(distance)
    const eff = Number(efficiency)
    const costPerUnit = Number(currentFuelPrice)
    const pastCostPerUnit = Number(pastFuelPrice)

    // Energy consumed in liters or kWh
    const consumed = (d * eff) / 100

    // Previous estimated cost: approximate old system cost using past fuel price
    const previousEstimatedCost = consumed * pastCostPerUnit

    // New fuel cost (energy only) using current fuel price
    const newFuelCost = consumed * costPerUnit

    // Road taxes under new system
    const roadTaxPerKm = 6.95
    const newTaxes = d * roadTaxPerKm

    const newTotalCost = newFuelCost + newTaxes

    setComputedBreakdown({ consumed, previousEstimatedCost, newFuelCost, newTaxes, newTotalCost })
  }

  const savings = useMemo(() => {
    if (!computedBreakdown) return null
    return computedBreakdown.previousEstimatedCost - computedBreakdown.newTotalCost
  }, [computedBreakdown])

  // Generate graph data for distance comparison (0 to 2x user's distance)
  const graphData = useMemo(() => {
    if (!computedBreakdown || !distance || !efficiency || !currentFuelPrice || !pastFuelPrice) return []
    
    const maxDistance = typeof distance === 'number' ? distance * 2 : 0
    const step = Math.ceil(maxDistance / 20) // 20 data points
    const data = []

    for (let d = 0; d <= maxDistance; d += step) {
      const consumed = (d * (typeof efficiency === 'number' ? efficiency : 0)) / 100
      const oldSystemCost = consumed * (typeof pastFuelPrice === 'number' ? pastFuelPrice : 0)
      const newSystemCost = (d * 6.95) + (consumed * (typeof currentFuelPrice === 'number' ? currentFuelPrice : 0))
      
      data.push({
        distance: d,
        [t('oldSystem')]: Math.round(oldSystemCost),
        [t('newSystem')]: Math.round(newSystemCost),
      })
    }

    return data
  }, [computedBreakdown, distance, efficiency, currentFuelPrice, pastFuelPrice, t])

  // Generate graph data for vehicle type comparison (current vs other vehicle type with defaults)
  const vehicleComparisonData = useMemo(() => {
    if (!computedBreakdown || !distance) return []
    
    const maxDistance = typeof distance === 'number' ? distance * 2 : 0
    const step = Math.ceil(maxDistance / 20) // 20 data points
    const data = []

    // Get the other vehicle type and its defaults
    const otherVehicleType: VehicleType = vehicleType === 'Electric' ? 'Petrol/Diesel' : 'Electric'
    const otherEfficiency = defaultEfficiency[otherVehicleType]
    const otherCurrentPrice = defaultCurrentPrice[otherVehicleType]
    const otherPastPrice = defaultPastPrice[otherVehicleType]

    // Current vehicle type labels
    const currentNewLabel = vehicleType === 'Electric' ? `${t('electric')} ${t('newSystemLabel')}` : `${t('petrolDiesel')} ${t('newSystemLabel')}`
    const currentOldLabel = vehicleType === 'Electric' ? `${t('electric')} ${t('oldSystemLabel')}` : `${t('petrolDiesel')} ${t('oldSystemLabel')}`
    const otherNewLabel = otherVehicleType === 'Electric' ? `${t('electric')} ${t('newSystemLabel')}` : `${t('petrolDiesel')} ${t('newSystemLabel')}`
    const otherOldLabel = otherVehicleType === 'Electric' ? `${t('electric')} ${t('oldSystemLabel')}` : `${t('petrolDiesel')} ${t('oldSystemLabel')}`

    for (let d = 0; d <= maxDistance; d += step) {
      // Current vehicle calculation - NEW system
      const currentConsumed = (d * (typeof efficiency === 'number' ? efficiency : 0)) / 100
      const currentNewCost = (d * 6.95) + (currentConsumed * (typeof currentFuelPrice === 'number' ? currentFuelPrice : 0))
      
      // Current vehicle calculation - OLD system
      const currentOldCost = currentConsumed * (typeof pastFuelPrice === 'number' ? pastFuelPrice : 0)
      
      // Other vehicle calculation - NEW system (using defaults)
      const otherConsumed = (d * otherEfficiency) / 100
      const otherNewCost = (d * 6.95) + (otherConsumed * otherCurrentPrice)
      
      // Other vehicle calculation - OLD system (using defaults)
      const otherOldCost = otherConsumed * otherPastPrice
      
      data.push({
        distance: d,
        [currentNewLabel]: Math.round(currentNewCost),
        [currentOldLabel]: Math.round(currentOldCost),
        [otherNewLabel]: Math.round(otherNewCost),
        [otherOldLabel]: Math.round(otherOldCost),
      })
    }

    return data
  }, [computedBreakdown, distance, efficiency, currentFuelPrice, pastFuelPrice, vehicleType, t])

  // Generate graph data for efficiency comparison (current efficiency, +1, -1)
  const efficiencyComparisonData = useMemo(() => {
    if (!computedBreakdown || !distance || !efficiency || !currentFuelPrice || !pastFuelPrice) return []
    
    const maxDistance = typeof distance === 'number' ? distance * 2 : 0
    const step = Math.ceil(maxDistance / 20) // 20 data points
    const data = []

    const baseEfficiency = typeof efficiency === 'number' ? efficiency : 0
    const lessEfficientValue = baseEfficiency + 1
    const moreEfficientValue = Math.max(0, baseEfficiency - 1)

    for (let d = 0; d <= maxDistance; d += step) {
      // Base efficiency - Old System
      const baseConsumed = (d * baseEfficiency) / 100
      const baseOldCost = baseConsumed * (typeof pastFuelPrice === 'number' ? pastFuelPrice : 0)
      
      // Base efficiency - New System
      const baseNewCost = (d * 6.95) + (baseConsumed * (typeof currentFuelPrice === 'number' ? currentFuelPrice : 0))
      
      // Less efficient (+1 L/100km) - New System
      const lessEfficientConsumed = (d * lessEfficientValue) / 100
      const lessEfficientCost = (d * 6.95) + (lessEfficientConsumed * (typeof currentFuelPrice === 'number' ? currentFuelPrice : 0))
      
      // More efficient (-1 L/100km) - New System
      const moreEfficientConsumed = (d * moreEfficientValue) / 100
      const moreEfficientCost = (d * 6.95) + (moreEfficientConsumed * (typeof currentFuelPrice === 'number' ? currentFuelPrice : 0))
      
      data.push({
        distance: d,
        [t('oldSystem')]: Math.round(baseOldCost),
        [`${t('newSystem')} (${baseEfficiency} ${efficiencyUnit})`]: Math.round(baseNewCost),
        [`${t('newSystem')} (+1: ${lessEfficientValue} ${efficiencyUnit})`]: Math.round(lessEfficientCost),
        [`${t('newSystem')} (-1: ${moreEfficientValue} ${efficiencyUnit})`]: Math.round(moreEfficientCost),
      })
    }

    return data
  }, [computedBreakdown, distance, efficiency, currentFuelPrice, pastFuelPrice, efficiencyUnit, t])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-medium text-gray-800">{t('title')}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => i18n.changeLanguage('en')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                i18n.language === 'en'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              English
            </button>
            <button
              onClick={() => i18n.changeLanguage('is')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                i18n.language === 'is'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Íslenska
            </button>
            <button
              onClick={() => i18n.changeLanguage('ga')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                i18n.language === 'ga'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Gaeilge
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCalculate()
            }}
            className="bg-white p-6 rounded-lg shadow-md border border-gray-200"
          >
            <h2 className="text-base font-semibold mb-4 text-gray-700 border-b pb-2">{t('inputs')}</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('vehicleType')}</span>
                <select
                  value={vehicleType}
                  onChange={(e) => {
                    const vt = e.target.value as VehicleType
                    setVehicleType(vt)
                    setEfficiency(defaultEfficiency[vt])
                    setCurrentFuelPrice(defaultCurrentPrice[vt])
                    setPastFuelPrice(defaultPastPrice[vt])
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>{t('petrolDiesel')}</option>
                  <option>{t('electric')}</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('annualDistance')}</span>
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value === '' ? '' : Number(e.target.value))}
                  min={0}
                  step={1}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">{t('currentPrice')}</span>
                  <div className="relative">
                    <input
                      type="number"
                      value={currentFuelPrice}
                      onChange={(e) => setCurrentFuelPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      step={0.1}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-500">{unitLabel}</span>
                  </div>
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">{t('pastPrice')}</span>
                  <div className="relative">
                    <input
                      type="number"
                      value={pastFuelPrice}
                      onChange={(e) => setPastFuelPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      step={0.1}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-500">{unitLabel}</span>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('efficiency')}</span>
                <div className="relative">
                  <input
                    type="number"
                    value={efficiency}
                    onChange={(e) => setEfficiency(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-500">{efficiencyUnit}</span>
                </div>
              </label>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-md">
                  <ul className="list-disc pl-5 text-sm">
                    {errors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  {t('calculate')}
                </button>

                <button
                  type="button"
                  className="px-4 py-2.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setVehicleType('Petrol/Diesel')
                    setDistance(15000)
                    setEfficiency(defaultEfficiency['Petrol/Diesel'])
                    setCurrentFuelPrice(185)
                    setPastFuelPrice(300)
                    setErrors([])
                    setComputedBreakdown(null)
                  }}
                >
                  {t('reset')}
                </button>
              </div>
            </div>
          </form>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h2 className="text-base font-semibold mb-4 text-gray-700 border-b pb-2">{t('results')}</h2>
            {computedBreakdown ? (
              <div className="space-y-3">
                <div className="py-2 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('previousEstimatedCost')}</span>
                    <span className="font-semibold text-gray-800">{formatISK(computedBreakdown.previousEstimatedCost)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {computedBreakdown.consumed.toFixed(2)} {efficiencyUnit.includes('kWh') ? 'kWh' : 'L'} × {pastFuelPrice} {unitLabel} = {formatISK(computedBreakdown.previousEstimatedCost)}
                  </p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{vehicleType === 'Electric' ? t('newPriceJustElectricity') : t('newPriceJustFuel')}</span>
                    <span className="font-medium text-gray-800">{formatISK(computedBreakdown.newFuelCost)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {computedBreakdown.consumed.toFixed(2)} {efficiencyUnit.includes('kWh') ? 'kWh' : 'L'} × {currentFuelPrice} {unitLabel} = {formatISK(computedBreakdown.newFuelCost)}
                  </p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('newPriceJustTaxes')}</span>
                    <span className="font-medium text-gray-800">{formatISK(computedBreakdown.newTaxes)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {distance.toLocaleString()} {t('km')} × 6.95 ISK/{t('km')} = {formatISK(computedBreakdown.newTaxes)}
                  </p>
                </div>

                <div className="py-2.5 border-t border-gray-200 mt-3 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">{t('newTotalPrice')}</span>
                    <span className="font-bold text-gray-900 text-lg">{formatISK(computedBreakdown.newTotalCost)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatISK(computedBreakdown.newFuelCost)} ({vehicleType === 'Electric' ? t('electric').toLowerCase() : t('newPriceJustFuel').split('—')[1]?.trim()}) + {formatISK(computedBreakdown.newTaxes)} ({t('newPriceJustTaxes').split('—')[1]?.trim()})
                  </p>
                </div>

                <div className="py-2.5 bg-gray-50 rounded-md px-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{t('savingsExtraCost')}</span>
                    {(() => {
                      let cls = ''
                      if (savings !== null) cls = savings >= 0 ? 'text-green-600' : 'text-red-600'
                      return (
                        <span className={`font-bold text-lg ${cls}`}>
                          {savings === null ? '—' : `${savings.toLocaleString('en-GB', { maximumFractionDigits: 0 })} ISK`}
                        </span>
                      )
                    })()}
                  </div>
                  {savings !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatISK(computedBreakdown.previousEstimatedCost)} - {formatISK(computedBreakdown.newTotalCost)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-8">{t('enterInputsMessage')}</div>
            )}
          </div>
        </div>

        {/* Expandable Graph Card */}
        {computedBreakdown && graphData.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <button
              onClick={() => setIsGraphExpanded(!isGraphExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-base font-semibold text-gray-700">
                {t('costComparisonOverDistance')}
              </h2>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${isGraphExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isGraphExpanded && (
              <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-4">
                  {vehicleType === 'Electric' ? t('comparisonOldElectricityTax') : t('comparisonOldFuelTax')} {typeof distance === 'number' ? distance * 2 : 0} {t('km')}
                </p>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: `${t('distance')} (${t('km')})`, position: 'insideBottom', offset: -5 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: `${t('cost')} (ISK)`, angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value ? `${value.toLocaleString()} ISK` : '—'}
                      labelFormatter={(label) => `${t('distance')}: ${label.toLocaleString()} ${t('km')}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey={t('oldSystem')} 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={t('newSystem')} 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Vehicle Type Comparison Graph Card */}
        {computedBreakdown && vehicleComparisonData.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <button
              onClick={() => setIsVehicleComparisonExpanded(!isVehicleComparisonExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-base font-semibold text-gray-700">
                {t('vehicleTypeComparison')}
              </h2>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${isVehicleComparisonExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isVehicleComparisonExpanded && (
              <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-4">
                  {t('comparisonYourVehicle')} {vehicleType === 'Electric' ? t('electric') : t('petrolDiesel')} {t('vehicle')} {vehicleType === 'Electric' ? t('petrolDiesel') : t('electric')} {t('vehicleWithDefaults')} {typeof distance === 'number' ? distance * 2 : 0} {t('km')}
                </p>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={vehicleComparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: `${t('distance')} (${t('km')})`, position: 'insideBottom', offset: -5 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: `${t('cost')} (ISK)`, angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value ? `${value.toLocaleString()} ISK` : '—'}
                      labelFormatter={(label) => `${t('distance')}: ${label.toLocaleString()} ${t('km')}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey={vehicleType === 'Electric' ? `${t('electric')} ${t('newSystemLabel')}` : `${t('petrolDiesel')} ${t('newSystemLabel')}`} 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={vehicleType === 'Electric' ? `${t('electric')} ${t('oldSystemLabel')}` : `${t('petrolDiesel')} ${t('oldSystemLabel')}`} 
                      stroke="#84cc16" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={vehicleType === 'Electric' ? `${t('petrolDiesel')} ${t('newSystemLabel')}` : `${t('electric')} ${t('newSystemLabel')}`} 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={vehicleType === 'Electric' ? `${t('petrolDiesel')} ${t('oldSystemLabel')}` : `${t('electric')} ${t('oldSystemLabel')}`} 
                      stroke="#fbbf24" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Efficiency Comparison Graph Card */}
        {computedBreakdown && efficiencyComparisonData.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <button
              onClick={() => setIsEfficiencyComparisonExpanded(!isEfficiencyComparisonExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-base font-semibold text-gray-700">
                {t('fuelEfficiencyImpact')}
              </h2>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${isEfficiencyComparisonExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isEfficiencyComparisonExpanded && (
              <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-4">
                  {t('howEfficiencyAffects')} {efficiencyUnit} {t('variationsUnderNewSystem')} {typeof distance === 'number' ? distance * 2 : 0} {t('km')}
                </p>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={efficiencyComparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: `${t('distance')} (${t('km')})`, position: 'insideBottom', offset: -5 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: `${t('cost')} (ISK)`, angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value ? `${value.toLocaleString()} ISK` : '—'}
                      labelFormatter={(label) => `${t('distance')}: ${label.toLocaleString()} ${t('km')}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey={t('oldSystem')} 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={`${t('newSystem')} (${typeof efficiency === 'number' ? efficiency : 0} ${efficiencyUnit})`}
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={`${t('newSystem')} (+1: ${typeof efficiency === 'number' ? efficiency + 1 : 1} ${efficiencyUnit})`}
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={`${t('newSystem')} (-1: ${typeof efficiency === 'number' ? Math.max(0, efficiency - 1) : 0} ${efficiencyUnit})`}
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
