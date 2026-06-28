import json
import os
from playwright.sync_api import sync_playwright

os.makedirs("d:/Trae/work/test_results", exist_ok=True)

console_logs = []
network_requests = []

def log_console(msg):
    console_logs.append(f"[{msg.type}] {msg.text}")

def log_request(request):
    if "/api/" in request.url:
        network_requests.append({
            "method": request.method,
            "url": request.url,
            "post_data": request.post_data
        })

def log_response(response):
    if "/api/" in response.url:
        try:
            body = response.json()
            for req in reversed(network_requests):
                if "response" not in req and req["url"] == response.url:
                    req["status"] = response.status
                    req["response"] = body
                    break
        except:
            for req in reversed(network_requests):
                if "response" not in req and req["url"] == response.url:
                    req["status"] = response.status
                    break

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    
    page.on("console", log_console)
    page.on("request", log_request)
    page.on("response", log_response)
    
    print("=== 1. 打开页面 ===")
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="d:/Trae/work/test_results/01_initial.png", full_page=True)
    print("OK")
    
    print("\n=== 2. 输入测试文本并点击'直接生成总结' ===")
    chat_input = page.locator("#chatInput")
    chat_input.fill("城市夜景 vlog，一个人下班后穿过街区，想要孤独但高级感，不要太吵")
    
    force_summary_btn = page.locator("#forceSummary")
    force_summary_btn.click()
    page.wait_for_timeout(3000)
    
    summary_editor = page.locator("#summaryEditor")
    summary_text = ""
    if summary_editor.is_visible():
        summary_text = summary_editor.input_value()
    print(f"需求总结(前300字):\n{summary_text[:300]}")
    
    print("\n=== 3. 点击'确认需求并生成歌单' ===")
    confirm_btn = page.locator("#confirmSummary")
    confirm_btn.click()
    
    print("等待搜索完成(20秒)...")
    page.wait_for_timeout(20000)
    
    page.screenshot(path="d:/Trae/work/test_results/03_after_search.png", full_page=True)
    
    print("\n=== 控制台错误/警告 ===")
    for log in console_logs:
        if "error" in log.lower() or "warn" in log.lower():
            print(f"  {log[:200]}")
    
    print("\n=== API 请求 ===")
    for req in network_requests:
        print(f"  {req['method']} {req['url']} - Status: {req.get('status', 'pending')}")
        if "response" in req:
            resp = req["response"]
            if isinstance(resp, dict) and "tracks" in resp:
                print(f"    返回 {resp.get('total', 0)} 首, 来源: {resp.get('sources', {})}")
                if req.get("post_data"):
                    try:
                        pd = json.loads(req["post_data"])
                        print(f"    搜索关键词: {pd.get('keyword', '?')}")
                    except:
                        pass
    
    # 检查JS状态
    state = page.evaluate("""() => {
        const task = AppState.loadState();
        const active = task.tasks.find(t => t.id === task.activeId);
        if (!active || !active.results) return {error: 'no results'};
        return {
            total: active.results.length,
            remote: active.results.filter(t => t._source === 'remote').length,
            local: active.results.filter(t => t._source === 'local').length,
            remoteLoading: active._remoteLoading,
            remoteError: active._remoteError,
            keyword: active._lastKeyword || null,
            top5: active.results.slice(0, 5).map(t => ({
                title: t.title,
                artist: t.artist,
                platform: t.platform,
                source: t._source,
                score: t.score,
                hasPreview: !!(t._previewUrl || t.previewUrl),
                reasons: t.reasons ? t.reasons.slice(0,3) : []
            }))
        };
    }""")
    
    print(f"\n=== 最终结果状态 ===")
    print(json.dumps(state, ensure_ascii=False, indent=2))
    
    # 结果列表DOM检查
    result_list = page.locator("#resultList")
    result_text = result_list.inner_text() if result_list.count() > 0 else ""
    print(f"\n=== 页面显示结果(前600字) ===\n{result_text[:600]}")
    
    playlist_pill = page.locator("#playlistPill").inner_text()
    metric_tracks = page.locator("#metricTracks").inner_text()
    metric_fit = page.locator("#metricFit").inner_text()
    print(f"\n歌单状态: {playlist_pill}, 曲库: {metric_tracks}, 匹配: {metric_fit}")
    
    page.screenshot(path="d:/Trae/work/test_results/04_final.png", full_page=True)
    browser.close()
    print("\n=== 测试完成 ===")
