// --- 1. ตั้งค่าการเชื่อมต่อ (เปลี่ยนเป็นค่าของคุณ) ---
const SUPABASE_URL = 'https://vtjkgfausdyldboiaein.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5jYp51pYwD1ulw5ktU9vPA_-wa6d3ST'; // ใส่ ANON KEY ของคุณ
let MAX_DISTANCE = 30;
let lastDistance = 0;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ผูก Slider กับ Input ตัวเลข
const slider = document.getElementById('maxDistSlider');
const numberInput = document.getElementById('maxDistInput');

slider.oninput = function() { numberInput.value = this.value; };
numberInput.oninput = function() { slider.value = this.value; };

function updateMaxDistance() {
    MAX_DISTANCE = parseFloat(numberInput.value);
    updateUI(lastDistance);
    console.log("Updated Max Distance to:", MAX_DISTANCE);
}

function updateUI(distance) {
    lastDistance = distance;
    let fillPercent = ((MAX_DISTANCE - distance) / MAX_DISTANCE) * 100;
    fillPercent = Math.min(Math.max(fillPercent, 0), 100);

    const liquid = document.getElementById('wasteLevel');
    const badge = document.getElementById('statusBadge');
    
    liquid.style.height = fillPercent + '%';
    document.getElementById('distVal').innerText = distance.toFixed(1);

    // ปรับสีตามสถานะ
    if (fillPercent > 80) {
        liquid.style.background = 'linear-gradient(to top, #ff0844 0%, #ffb199 100%)';
        badge.innerText = "🚨 ถังขยะเต็มแล้ว!";
        badge.style.background = "#ff4d4d";
    } else if (fillPercent > 50) {
        liquid.style.background = 'linear-gradient(to top, #f9d423 0%, #ff4e50 100%)';
        badge.innerText = "⚠️ เริ่มหนาแน่น";
        badge.style.background = "#f39c12";
    } else {
        liquid.style.background = 'linear-gradient(to top, #4facfe 0%, #00f2fe 100%)';
        badge.innerText = "✅ สถานะปกติ";
        badge.style.background = "#2ecc71";
    }

    document.getElementById('timeText').innerText = "อัปเดตล่าสุด: " + new Date().toLocaleTimeString('th-TH');
}

// โหลดข้อมูลเริ่มต้นและสมัครรับ Real-time
async function init() {
    const { data } = await supabaseClient.from('smart_bin').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) updateUI(data[0].distance);

    supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'smart_bin' }, payload => {
        updateUI(payload.new.distance);
    }).subscribe();
}

init();