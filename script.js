// --- 1. ตั้งค่าการเชื่อมต่อ ---
const SUPABASE_URL = 'https://vtjkgfausdyldboiaein.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5jYp51pYwD1ulw5ktU9vPA_-wa6d3ST';
const DISCORD_WEBHOOK_URL = 'https://discordapp.com/api/webhooks/1501882110955491429/DleD8QyuQwtkjm7jqyXgiIl6OOTO6o6uo9xxrsfzy_-SIf6n685FpfUMO-zcl5aNUDbL'; // นำ Webhook URL จาก Discord มาวาง
let isAlerted = false; // ใช้ล็อกเพื่อไม่ให้ส่งข้อความซ้ำรัวๆ เมื่อขยะเกิน 80%
let MAX_DISTANCE = 30;
let lastDistance = 0;
let myChart; 

// ตัวแปรสำหรับเก็บประวัติข้อมูล เพื่อนำไปใช้คำนวณพยากรณ์
let historyData = []; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const slider = document.getElementById('maxDistSlider');
const numberInput = document.getElementById('maxDistInput');

slider.oninput = function() { numberInput.value = this.value; };
numberInput.oninput = function() { slider.value = this.value; };

function updateMaxDistance() {
    MAX_DISTANCE = parseFloat(numberInput.value);
    updateUI(lastDistance);
    analyzeTrashTrend(); // ให้คำนวณพยากรณ์ใหม่เมื่อเปลี่ยนความจุ
}

// ----------------------------------------------------
// ส่วนจัดการกราฟ (Chart.js)
// ----------------------------------------------------
function initChart() {
    const ctx = document.getElementById('wasteChart').getContext('2d');
    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [{
                label: 'ปริมาณขยะ (%)',
                data: [], 
                borderColor: '#00f2fe',
                backgroundColor: 'rgba(0, 242, 254, 0.2)', 
                borderWidth: 2,
                pointBackgroundColor: '#4facfe',
                pointRadius: 4,
                fill: true,
                tension: 0.4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'ความจุ (%)' } },
                x: { title: { display: true, text: 'เวลา' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function updateChartData(percent, timeString) {
    if (!myChart) return;
    myChart.data.labels.push(timeString);
    myChart.data.datasets[0].data.push(percent);
    if (myChart.data.labels.length > 15) {
        myChart.data.labels.shift();
        myChart.data.datasets[0].data.shift();
    }
    myChart.update();
}

async function sendDiscordWebhook(percent, distance, timeLeft) {
    // เอา if (isAlerted) return; ออกเพื่อให้ส่งได้ตลอด

    const payload = {
        username: "Smart Bin Update",
        embeds: [{
            title: "📊 อัปเดตสถานะถังขยะ",
            color: percent >= 80 ? 16711680 : 65280,
            fields: [
                { name: "ความจุของถังขยะปัจจุบัน", value: `${percent.toFixed(0)}%`, inline: true },
                { name: "เวลาที่คาดการณ์ว่าจะเต็ม", value: timeLeft, inline: true }
                // นำส่วนระยะ CM ออกเพื่อให้ตรงตามความต้องการของคุณ
            ],
            timestamp: new Date().toISOString()
        }]
    };

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log("Discord Live Update Sent!");
    } catch (error) {
        console.error("Webhook Error:", error);
    }
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
    document.getElementById('distVal').innerText = Math.round(fillPercent);

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

    const timeLeft = document.getElementById('predTime').innerText; // ดึงค่าเวลาที่พยากรณ์ไว้

    sendDiscordWebhook(fillPercent, distance, timeLeft);

    const displayTime = timeString ? new Date(timeString).toLocaleTimeString('th-TH') : new Date().toLocaleTimeString('th-TH');
    document.getElementById('timeText').innerText = "อัปเดตล่าสุด: " + displayTime;
    updateChartData(fillPercent, displayTime);
}

// ----------------------------------------------------
// ฟังก์ชันวิเคราะห์และพยากรณ์ (ได้รับการแก้ไขแล้ว)
// ----------------------------------------------------
// --- แก้ไขฟังก์ชันวิเคราะห์และพยากรณ์ใหม่ ---
function analyzeTrashTrend() {
    const predElement = document.getElementById('predTime');
    const trendElement = document.getElementById('trendIcon');

    if (historyData.length < 2) {
        predElement.innerText = "กำลังเก็บข้อมูล...";
        return;
    }

    const currentData = historyData[historyData.length - 1];
    const pastData = historyData[0];

    // คำนวณ % ปัจจุบัน
    const currentPercent = Math.min(Math.max(((MAX_DISTANCE - currentData.distance) / MAX_DISTANCE) * 100, 0), 100);
    const pastPercent = Math.min(Math.max(((MAX_DISTANCE - pastData.distance) / MAX_DISTANCE) * 100, 0), 100);
    
    const startTime = new Date(pastData.created_at);
    const endTime = new Date(currentData.created_at);
    const hoursPassed = (endTime - startTime) / (1000 * 60 * 60);

    if (hoursPassed <= 0.005) return;

    const fillRate = (currentPercent - pastPercent) / hoursPassed;

    // --- ส่วนที่ปรับปรุงใหม่: เช็คจาก % ก่อน แล้วค่อยเช็คความเร็ว ---

    if (currentPercent >= 90) {
        // 1. ถ้าเกิน 90% ให้บอกว่าเต็มแล้ว/ต้องทิ้งทันที
        predElement.innerText = "เต็มแล้ว / ควรทิ้ง";
        trendElement.innerHTML = "🚨 วิกฤต";
        trendElement.style.color = "#ff4d4d";
    } 
    else if (currentPercent >= 75 && fillRate <= 0.5) {
        // 2. ถ้าอยู่ระหว่าง 75-89% และไม่มีคนทิ้งเพิ่ม (Rate ต่ำ)
        predElement.innerText = "ใกล้เต็มมากแล้ว";
        trendElement.innerHTML = "⚠️ เฝ้าระวัง";
        trendElement.style.color = "#f9d423";
    }
    else if (fillRate > 0.5) { 
        // 3. กรณีขยะกำลังเพิ่มขึ้น (คำนวณเวลา)
        const percentLeft = 100 - currentPercent;
        const hoursLeft = percentLeft / fillRate;
        
        if (hoursLeft < 1) {
            predElement.innerText = Math.round(hoursLeft * 60) + " นาที";
        } else {
            predElement.innerText = hoursLeft.toFixed(1) + " ชม.";
        }
        trendElement.innerHTML = "📈 กำลังเพิ่มขึ้น";
        trendElement.style.color = "#ff4d4d";
    } 
    else if (fillRate < -15.0) { 
        // 4. กรณีขยะลดลงอย่างรวดเร็ว
        predElement.innerText = "เพิ่งเทขยะออก";
        trendElement.innerHTML = "📉 ลดลง";
        trendElement.style.color = "#2ecc71";
    } 
    else {
        // 5. กรณีขยะนิ่งๆ และ % ยังไม่สูง
        predElement.innerText = "ยังไม่เต็มเร็วๆ นี้";
        trendElement.innerHTML = "➖ คงที่";
        trendElement.style.color = "#aaa";
    }
}

// ----------------------------------------------------
// ระบบดึงข้อมูลและ Real-time
// ----------------------------------------------------
async function init() {
    initChart(); 

    const { data } = await supabaseClient
        .from('smart_bin')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

    if (data && data.length > 0) {
        historyData = data.reverse(); // บันทึกข้อมูลลงตัวแปรประวัติ
        
        for (let i = 0; i < historyData.length; i++) {
            if (i === historyData.length - 1) {
                updateUI(historyData[i].distance, historyData[i].created_at);
            } else {
                let fillPercent = ((MAX_DISTANCE - historyData[i].distance) / MAX_DISTANCE) * 100;
                fillPercent = Math.min(Math.max(fillPercent, 0), 100);
                let timeStr = new Date(historyData[i].created_at).toLocaleTimeString('th-TH');
                updateChartData(fillPercent, timeStr);
            }
        }
        
        // สั่งให้คำนวณพยากรณ์ตอนโหลดหน้าเว็บครั้งแรก
        analyzeTrashTrend(); 
    }

    supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'smart_bin' }, payload => {
        // นำข้อมูลใหม่ใส่เข้าไปในประวัติ และลบอันเก่าสุดทิ้งถ้าเกิน 15 อัน
        historyData.push(payload.new);
        if (historyData.length > 15) historyData.shift();

        updateUI(payload.new.distance, payload.new.created_at);
        
        // สั่งให้คำนวณพยากรณ์อัปเดตใหม่ทันทีที่คนทิ้งขยะ
        analyzeTrashTrend(); 
    }).subscribe();
}

init();