import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, MapPin, Globe, Building, Navigation } from 'lucide-react';
import { ALL_COUNTRY_PHONE_CODES, POPULAR_COUNTRY_CODES, CountryPhoneCode } from '../data/countryPhoneCodes';
import {
  getStatesForCountry,
  getDistrictsForState,
  getPostalCodeConfig
} from '../data/locationHierarchy';

interface AddressHierarchySelectorProps {
  country: string;
  onCountryChange: (country: string, flag: string) => void;
  state: string;
  onStateChange: (state: string) => void;
  district: string;
  onDistrictChange: (district: string) => void;
  pincode: string;
  onPincodeChange: (pincode: string) => void;
  address?: string;
  onAddressChange?: (address: string) => void;
  showResidentialAddress?: boolean;
  required?: boolean;
}

export const AddressHierarchySelector: React.FC<AddressHierarchySelectorProps> = ({
  country,
  onCountryChange,
  state,
  onStateChange,
  district,
  onDistrictChange,
  pincode,
  onPincodeChange,
  address = '',
  onAddressChange,
  showResidentialAddress = true,
  required = true
}) => {
  // Country Dropdown Modal/Search state
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Custom typing toggle for state & district if user chooses "Other"
  const [isCustomState, setIsCustomState] = useState(false);
  const [isCustomDistrict, setIsCustomDistrict] = useState(false);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setIsCountryOpen(false);
      }
    };
    if (isCountryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCountryOpen]);

  // Current Country Object (for flag)
  const currentCountryObj = useMemo(() => {
    return (
      ALL_COUNTRY_PHONE_CODES.find(
        (c) => c.name.toLowerCase() === (country || 'India').toLowerCase()
      ) || { name: 'India', flag: '🇮🇳', code: 'IN', dialCode: '+91' }
    );
  }, [country]);

  // Available states for selected country
  const availableStates = useMemo(() => {
    return getStatesForCountry(country || 'India');
  }, [country]);

  // Available districts for selected state
  const availableDistricts = useMemo(() => {
    return getDistrictsForState(country || 'India', state);
  }, [country, state]);

  // Postal code label & placeholder
  const postalConfig = useMemo(() => {
    return getPostalCodeConfig(country || 'India');
  }, [country]);

  // Filtered countries for country modal search
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return ALL_COUNTRY_PHONE_CODES;
    return ALL_COUNTRY_PHONE_CODES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // Handle Country selection
  const handleSelectCountry = (selected: CountryPhoneCode) => {
    onCountryChange(selected.name, selected.flag);
    setIsCountryOpen(false);
    setCountrySearch('');

    const newStates = getStatesForCountry(selected.name);
    if (newStates.length > 0) {
      setIsCustomState(false);
      const firstState = newStates[0].name;
      onStateChange(firstState);

      const newDistricts = newStates[0].districts;
      if (newDistricts && newDistricts.length > 0) {
        setIsCustomDistrict(false);
        onDistrictChange(newDistricts[0]);
      } else {
        setIsCustomDistrict(true);
        onDistrictChange('');
      }
    } else {
      // If country doesn't have predefined states in dataset
      setIsCustomState(true);
      onStateChange('');
      setIsCustomDistrict(true);
      onDistrictChange('');
    }
  };

  // Handle State selection
  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomState(true);
      onStateChange('');
      setIsCustomDistrict(true);
      onDistrictChange('');
    } else {
      setIsCustomState(false);
      onStateChange(val);

      const districts = getDistrictsForState(country, val);
      if (districts.length > 0) {
        setIsCustomDistrict(false);
        if (district && districts.includes(district)) {
          onDistrictChange(district);
        } else {
          onDistrictChange(districts[0]);
        }
      } else {
        setIsCustomDistrict(true);
        onDistrictChange('');
      }
    }
  };

  // Handle District selection
  const handleDistrictSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomDistrict(true);
      onDistrictChange('');
    } else {
      setIsCustomDistrict(false);
      onDistrictChange(val);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* 1. COUNTRY SELECTOR (Name & Flag List) */}
      <div className="relative" ref={countryDropdownRef}>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#4A1D96]" />
            <span>Country</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-[10px] text-slate-500 font-medium">
            240+ Countries Available
          </span>
        </div>

        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsCountryOpen(!isCountryOpen)}
          aria-expanded={isCountryOpen}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 focus:border-[#4A1D96] rounded-xl text-xs font-semibold text-slate-900 transition-colors shadow-2xs cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="text-xl leading-none" role="img" aria-label={currentCountryObj.name}>
              {currentCountryObj.flag}
            </span>
            <span className="text-sm font-bold text-slate-800 group-hover:text-purple-950">
              {currentCountryObj.name}
            </span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
              {currentCountryObj.code}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-[11px] font-medium hidden sm:inline text-purple-600">Change</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isCountryOpen ? 'rotate-180 text-purple-600' : ''}`} />
          </div>
        </button>

        {/* Searchable Dropdown Modal */}
        {isCountryOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/90">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search any country (e.g. India, UAE, UK, USA, Saudi Arabia)..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-[#4A1D96]"
                />
              </div>
            </div>

            {/* Countries List */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
              {!countrySearch.trim() && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50/70 sticky top-0 z-10 backdrop-blur-xs">
                    Popular Countries
                  </div>
                  {POPULAR_COUNTRY_CODES.map((item) => (
                    <button
                      key={`pop-${item.code}-${item.name}`}
                      type="button"
                      onClick={() => handleSelectCountry(item)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-purple-50/70 transition-colors cursor-pointer ${
                        currentCountryObj.name.toLowerCase() === item.name.toLowerCase()
                          ? 'bg-purple-50 font-bold text-purple-900'
                          : 'text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-lg leading-none">{item.flag}</span>
                        <span className="truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">{item.code}</span>
                        {currentCountryObj.name.toLowerCase() === item.name.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-purple-700" />
                        )}
                      </div>
                    </button>
                  ))}
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100/80 sticky top-0 z-10 backdrop-blur-xs">
                    All Countries (A-Z)
                  </div>
                </>
              )}

              {filteredCountries.length > 0 ? (
                filteredCountries.map((item) => (
                  <button
                    key={`all-${item.code}-${item.name}`}
                    type="button"
                    onClick={() => handleSelectCountry(item)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-purple-50/70 transition-colors cursor-pointer ${
                      currentCountryObj.name.toLowerCase() === item.name.toLowerCase()
                        ? 'bg-purple-50 font-bold text-purple-900'
                        : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-lg leading-none">{item.flag}</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-400">{item.code}</span>
                      {currentCountryObj.name.toLowerCase() === item.name.toLowerCase() && (
                        <Check className="w-3.5 h-3.5 text-purple-700" />
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  No country found matching "{countrySearch}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. STATE/PROVINCE & 3. DISTRICT/CITY IN ADAPTIVE GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* STATE / PROVINCE */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-purple-600" />
              <span>State / Province</span>
              {required && <span className="text-rose-500">*</span>}
            </label>
            {availableStates.length > 0 && !isCustomState ? (
              <button
                type="button"
                onClick={() => {
                  setIsCustomState(true);
                  onStateChange('');
                  setIsCustomDistrict(true);
                  onDistrictChange('');
                }}
                className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold cursor-pointer underline"
              >
                Type Other
              </button>
            ) : availableStates.length > 0 && isCustomState ? (
              <button
                type="button"
                onClick={() => {
                  setIsCustomState(false);
                  onStateChange(availableStates[0]?.name || '');
                  const dists = availableStates[0]?.districts || [];
                  if (dists.length > 0) {
                    setIsCustomDistrict(false);
                    onDistrictChange(dists[0]);
                  }
                }}
                className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold cursor-pointer underline"
              >
                Choose from List
              </button>
            ) : null}
          </div>

          {availableStates.length > 0 && !isCustomState ? (
            <div className="relative">
              <select
                required={required}
                value={state}
                onChange={handleStateSelect}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-hidden focus:border-[#4A1D96] transition-colors appearance-none pr-8 cursor-pointer"
              >
                <option value="" disabled>-- Select State / Province --</option>
                {availableStates.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="__custom__">✎ Other (Type Custom State)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              required={required}
              value={state}
              onChange={(e) => onStateChange(e.target.value)}
              placeholder="e.g. Uttar Pradesh, California, Dubai"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-hidden focus:border-[#4A1D96]"
            />
          )}
        </div>

        {/* DISTRICT / CITY */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              <span>District / City</span>
              {required && <span className="text-rose-500">*</span>}
            </label>
            {availableDistricts.length > 0 && !isCustomDistrict ? (
              <button
                type="button"
                onClick={() => {
                  setIsCustomDistrict(true);
                  onDistrictChange('');
                }}
                className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold cursor-pointer underline"
              >
                Type Other
              </button>
            ) : availableDistricts.length > 0 && isCustomDistrict ? (
              <button
                type="button"
                onClick={() => {
                  setIsCustomDistrict(false);
                  onDistrictChange(availableDistricts[0] || '');
                }}
                className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold cursor-pointer underline"
              >
                Choose from List
              </button>
            ) : null}
          </div>

          {availableDistricts.length > 0 && !isCustomDistrict ? (
            <div className="relative">
              <select
                required={required}
                value={district}
                onChange={handleDistrictSelect}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-hidden focus:border-[#4A1D96] transition-colors appearance-none pr-8 cursor-pointer"
              >
                <option value="" disabled>-- Select District / City --</option>
                {availableDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="__custom__">✎ Other (Type Custom District / City)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              required={required}
              value={district}
              onChange={(e) => onDistrictChange(e.target.value)}
              placeholder="e.g. Amroha, Moradabad, New York"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-hidden focus:border-[#4A1D96]"
            />
          )}
        </div>
      </div>

      {/* 4. PIN / ZIP / POSTAL CODE */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-purple-600" />
            <span>{postalConfig.label}</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-[10px] text-slate-400 font-medium">
            Postal / Area Code
          </span>
        </div>
        <input
          type="text"
          required={required}
          value={pincode}
          onChange={(e) => onPincodeChange(e.target.value)}
          placeholder={postalConfig.placeholder}
          maxLength={15}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
        />
      </div>

      {/* 5. RESIDENTIAL / STREET ADDRESS (Optional detailed line) */}
      {showResidentialAddress && onAddressChange && (
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Residential Street Address <span className="text-slate-400 font-normal">(House / Flat / Street / Landmark)</span>
          </label>
          <textarea
            rows={2}
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="e.g. House No. 42, Street 3, Near Civil Lines"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
          />
        </div>
      )}
    </div>
  );
};
