// --- 1. ตั้งค่าการเชื่อมต่อ (เปลี่ยนเป็นค่าของคุณ) ---
const SUPABASE_URL = 'https://vtjkgfausdyldboiaein.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5jYp51pYwD1ulw5ktU9vPA_-wa6d3ST'; // ใส่ ANON KEY ของคุณ
let MAX_DISTANCE = 30;
let lastDistance = 0;
let myChart; // ตัวแปรกราฟ

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const slider = document.getElementById('maxDistSlider');
const numberInput = document.getElementById('maxDistInput');

slider.oninput = function() { numberInput.value = this.value; };
numberInput.oninput = function() { slider.value = this.value; };

function updateMaxDistance() {
    MAX_DISTANCE = parseFloat(numberInput.value);
    updateUI(lastDistance);
}

// ----------------------------------------------------
// ส่วนจัดการกราฟ (Chart.js)
// ----------------------------------------------------
function initChart() {
    const ctx = document.getElementById('wasteChart').getContext('2d');
    
    // ตั้งค่าสีตัวหนังสือเส้นขอบให้เป็นสีขาว/เทา เพื่อให้เข้ากับธีมมืด
    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // แกน X (เวลา)
            datasets: [{
                label: 'ปริมาณขยะ (%)',
                data: [], // แกน Y (เปอร์เซ็นต์ความจุ)
                borderColor: '#00f2fe',
                backgroundColor: 'rgba(0, 242, 254, 0.2)', // สีใต้เส้นกราฟ
                borderWidth: 2,
                pointBackgroundColor: '#4facfe',
                pointRadius: 4,
                fill: true,
                tension: 0.4 // ทำให้เส้นโค้งสมูท
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100, // ล็อกแกน Y ให้สูงสุดที่ 100%
                    title: { display: true, text: 'ความจุ (%)' }
                },
                x: {
                    title: { display: true, text: 'เวลา' }
                }
            },
            plugins: {
                legend: { display: false } // ซ่อนกล่องป้ายกำกับด้านบน
            }
        }
    });
}

function updateChartData(percent, timeString) {
    if (!myChart) return;
    
    // เพิ่มข้อมูลใหม่เข้าไป
    myChart.data.labels.push(timeString);
    myChart.data.datasets[0].data.push(percent);

    // ถ้าจุดเยอะเกิน 15 จุด ให้ลบจุดเก่าสุดออก (กันกราฟรก)
    if (myChart.data.labels.length > 15) {
        myChart.data.labels.shift();
        myChart.data.datasets[0].data.shift();
    }
    
    myChart.update(); // สั่งให้กราฟรีเฟรช
}

// ----------------------------------------------------
// ฟังก์ชันอัปเดตหน้าจอหลัก
// ----------------------------------------------------
function updateUI(distance, timeString = null) {
    lastDistance = distance;
    let fillPercent = ((MAX_DISTANCE - distance) / MAX_DISTANCE) * 100;
    fillPercent = Math.min(Math.max(fillPercent, 0), 100);

    const liquid = document.getElementById('wasteLevel');
    const badge = document.getElementById('statusBadge');
    
    liquid.style.height = fillPercent + '%';
    document.getElementById('distVal').innerText = distance.toFixed(1);

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

    // จัดการเรื่องเวลา
    const displayTime = timeString ? new Date(timeString).toLocaleTimeString('th-TH') : new Date().toLocaleTimeString('th-TH');
    document.getElementById('timeText').innerText = "อัปเดตล่าสุด: " + displayTime;

    // อัปเดตกราฟด้วย
    updateChartData(fillPercent, displayTime);
}

// ----------------------------------------------------
// ระบบดึงข้อมูลและ Real-time
// ----------------------------------------------------
async function init() {
    initChart(); // วาดกราฟเปล่าๆ รอไว้ก่อน

    // ดึงข้อมูลย้อนหลัง 15 แถวล่าสุดมาวาดกราฟ
    const { data } = await supabaseClient
        .from('smart_bin')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

    if (data && data.length > 0) {
        // ต้องเอาข้อมูลมา reverse ให้เรียงจากเก่าไปใหม่ กราฟจะได้เดินหน้าถูกต้อง
        const reversedData = data.reverse();
        
        // วนลูปใส่ข้อมูลเข้ากราฟ ยกเว้นอันล่าสุดให้ไปอัปเดตทั้งกราฟและรูปถังขยะ
        for (let i = 0; i < reversedData.length; i++) {
            if (i === reversedData.length - 1) {
                updateUI(reversedData[i].distance, reversedData[i].created_at);
            } else {
                let fillPercent = ((MAX_DISTANCE - reversedData[i].distance) / MAX_DISTANCE) * 100;
                fillPercent = Math.min(Math.max(fillPercent, 0), 100);
                let timeStr = new Date(reversedData[i].created_at).toLocaleTimeString('th-TH');
                updateChartData(fillPercent, timeStr);
            }
        }
    }

    // สมัครรับข้อมูล Real-time
    supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'smart_bin' }, payload => {
        updateUI(payload.new.distance, payload.new.created_at);
    }).subscribe();
}

init();