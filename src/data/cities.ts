export type CityId = 'paris' | 'amsterdam' | 'copenhagen'

export type City = {
  id: CityId
  name: string
  country: string
  activity: string
  gesture: string
  fact: string
  accent: string
}

export const cities: City[] = [
  { id: 'paris', name: 'Paris', country: 'France', activity: 'Catch falling pastries', gesture: 'Hand tracking', fact: 'Parisians eat billions of baguettes every year.', accent: '#e38b52' },
  { id: 'amsterdam', name: 'Amsterdam', country: 'The Netherlands', activity: 'Jump over tulip fields', gesture: 'Full-body tracking', fact: 'The Netherlands grows billions of tulip bulbs every year.', accent: '#d05b70' },
  { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark', activity: 'Build and ride a bicycle', gesture: 'Hand and pose tracking', fact: 'Copenhagen has more bicycles than people.', accent: '#4b99a3' },
]

export const getCity = (id?: string) => cities.find((city) => city.id === id)
