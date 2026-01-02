import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

type VehicleType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'

function formatISK(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-GB', { maximumFractionDigits: 0 }) + ' ISK'
}

function App() {
  // Inputs
  const [vehicleType, setVehicleType] = useState<VehicleType>('Petrol')
  const [distance, setDistance] = useState<number | ''>(15000)
  const [efficiency, setEfficiency] = useState<number | ''>(6.5) // L/100km or kWh/100km
  const [currentFuelPrice, setCurrentFuelPrice] = useState<number | ''>(185) // ISK per L or kWh
  const [pastFuelPrice, setPastFuelPrice] = useState<number | ''>(300) // ISK per L or kWh (historical)

  // Validation state
  const [errors, setErrors] = useState<string[]>([])

  // Graph expansion state
  const [isGraphExpanded, setIsGraphExpanded] = useState(false)

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

  // default efficiency by vehicle type (used to prefill efficiency when type changes)
  const defaultEfficiency: Record<VehicleType, number> = {
    Petrol: 6.5,
    Diesel: 5.5,
    Hybrid: 4,
    Electric: 18,
  }
  // NOTE: efficiency is auto-filled when vehicle type is changed via the select onChange handler.

  function validateInputs() {
    const errs: string[] = []
    if (distance === '' || Number.isNaN(Number(distance))) errs.push('Annual distance is required')
    else if (distance < 0) errs.push('Distance cannot be negative')
    else if (distance > 1_000_000) errs.push('Distance seems unreasonably large')

    if (efficiency === '' || Number.isNaN(Number(efficiency))) errs.push('Efficiency is required')
    else if (efficiency <= 0) errs.push('Efficiency must be greater than 0')
    else if (efficiency > 1000) errs.push('Efficiency seems unreasonably large')

    if (currentFuelPrice === '' || Number.isNaN(Number(currentFuelPrice))) errs.push('Current fuel price is required')
    else if (currentFuelPrice < 0) errs.push('Current fuel price cannot be negative')
    else if (currentFuelPrice > 10000) errs.push('Current fuel price seems unreasonably large')

    if (pastFuelPrice === '' || Number.isNaN(Number(pastFuelPrice))) errs.push('Past fuel price is required')
    else if (pastFuelPrice < 0) errs.push('Past fuel price cannot be negative')
    else if (pastFuelPrice > 10000) errs.push('Past fuel price seems unreasonably large')

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
        'Old System': Math.round(oldSystemCost),
        'New System': Math.round(newSystemCost),
      })
    }

    return data
  }, [computedBreakdown, distance, efficiency, currentFuelPrice, pastFuelPrice])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-lg font-medium mb-6 text-gray-800">Iceland Road Tax vs Fuel Tax Calculator</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCalculate()
            }}
            className="bg-white p-6 rounded-lg shadow-md border border-gray-200"
          >
            <h2 className="text-base font-semibold mb-4 text-gray-700 border-b pb-2">Inputs</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Vehicle type</span>
                <select
                  value={vehicleType}
                  onChange={(e) => {
                    const vt = e.target.value as VehicleType
                    setVehicleType(vt)
                    setEfficiency(defaultEfficiency[vt])
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Petrol</option>
                  <option>Diesel</option>
                  <option>Hybrid</option>
                  <option>Electric</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Annual distance (km)</span>
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
                  <span className="block text-sm font-medium text-gray-700 mb-1">Current price</span>
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
                  <span className="block text-sm font-medium text-gray-700 mb-1">Past price</span>
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
                <span className="block text-sm font-medium text-gray-700 mb-1">Efficiency</span>
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
                  Calculate
                </button>

                <button
                  type="button"
                  className="px-4 py-2.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setDistance(15000)
                    setEfficiency(defaultEfficiency['Petrol'])
                    setCurrentFuelPrice(185)
                    setPastFuelPrice(300)
                    setErrors([])
                    setComputedBreakdown(null)
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h2 className="text-base font-semibold mb-4 text-gray-700 border-b pb-2">Results</h2>
            {computedBreakdown ? (
              <div className="space-y-3">
                <div className="py-2 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Previous estimated cost</span>
                    <span className="font-semibold text-gray-800">{formatISK(computedBreakdown.previousEstimatedCost)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {computedBreakdown.consumed.toFixed(2)} {efficiencyUnit.includes('kWh') ? 'kWh' : 'L'} × {pastFuelPrice} {unitLabel} = {formatISK(computedBreakdown.previousEstimatedCost)}
                  </p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New price — just fuel</span>
                    <span className="font-medium text-gray-800">{formatISK(computedBreakdown.newFuelCost)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {computedBreakdown.consumed.toFixed(2)} {efficiencyUnit.includes('kWh') ? 'kWh' : 'L'} × {currentFuelPrice} {unitLabel} = {formatISK(computedBreakdown.newFuelCost)}
                  </p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New price — just taxes</span>
                    <span className="font-medium text-gray-800">{formatISK(computedBreakdown.newTaxes)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {distance.toLocaleString()} km × 6.95 ISK/km = {formatISK(computedBreakdown.newTaxes)}
                  </p>
                </div>

                <div className="py-2.5 border-t border-gray-200 mt-3 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">New total price</span>
                    <span className="font-bold text-gray-900 text-lg">{formatISK(computedBreakdown.newTotalCost)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatISK(computedBreakdown.newFuelCost)} (fuel) + {formatISK(computedBreakdown.newTaxes)} (taxes)
                  </p>
                </div>

                <div className="py-2.5 bg-gray-50 rounded-md px-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Savings / (Extra cost)</span>
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
              <div className="text-sm text-gray-500 text-center py-8">Enter inputs and click Calculate to see results.</div>
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
                Cost Comparison Over Distance
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
                  Comparison of old fuel tax system vs new distance-based system from 0 to {typeof distance === 'number' ? distance * 2 : 0} km
                </p>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: 'Cost (ISK)', angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value ? `${value.toLocaleString()} ISK` : '—'}
                      labelFormatter={(label) => `Distance: ${label.toLocaleString()} km`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="Old System" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="New System" 
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
      </div>
    </div>
  )
}

export default App
