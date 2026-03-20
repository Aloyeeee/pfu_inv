import { apiRequest } from '../modules/database.js';

export const monthsUa = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

export let pfuMVO = [];
export let pfuLocations = [];
export let pfuStructure = {};

export async function fetchSystemData() {
    try {
        const data = await apiRequest('get_system_data');
        
        pfuLocations = data.locations || [];
        pfuMVO = data.mvo || [];
        pfuStructure = data.structure || {};
        
        return true;
    } catch (err) {
        console.error("Помилка завантаження системних даних:", err);
        return false;
    }
}