import os
import time
from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By

def run_visual_tests():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1440,920')

    repo_dir = r"c:\Users\Userr\Projects\grzhackhathon"
    shots_dir = os.path.join(repo_dir, "docs", "screenshots")
    os.makedirs(shots_dir, exist_ok=True)

    driver = webdriver.Edge(options=options)
    try:
        driver.get("http://127.0.0.1:8000")
        time.sleep(3)
        
        # 1. Normal Scenario
        p1 = os.path.join(shots_dir, "01_normal_operation.png")
        driver.save_screenshot(p1)
        print("Saved:", p1)
        
        # 2. Loose Bolt Scenario
        btn2 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='LOOSE_BOLT']")
        btn2.click()
        time.sleep(3)
        p2 = os.path.join(shots_dir, "02_loose_bolt_warning.png")
        driver.save_screenshot(p2)
        print("Saved:", p2)

        # 3. WhatsApp / SMS Alert Smartphone Modal
        btn_phone = driver.find_element(By.ID, "btnOpenPhone")
        btn_phone.click()
        time.sleep(1.5)
        p_phone = os.path.join(shots_dir, "05_whatsapp_sms_dispatch.png")
        driver.save_screenshot(p_phone)
        print("Saved:", p_phone)
        
        # Close phone modal
        btn_close = driver.find_element(By.ID, "btnClosePhone")
        btn_close.click()
        time.sleep(1)

        # 4. Modbus Register Inspector Tab
        btn_modbus = driver.find_element(By.CSS_SELECTOR, "button[data-tab='tabModbus']")
        btn_modbus.click()
        time.sleep(1)
        p_modbus = os.path.join(shots_dir, "06_modbus_register_map.png")
        driver.save_screenshot(p_modbus)
        print("Saved:", p_modbus)

        # 5. Alarm & SOE Event Log Tab
        btn_alarms = driver.find_element(By.CSS_SELECTOR, "button[data-tab='tabAlarms']")
        btn_alarms.click()
        time.sleep(1)
        p_alarms = os.path.join(shots_dir, "07_alarm_soe_log.png")
        driver.save_screenshot(p_alarms)
        print("Saved:", p_alarms)

        # Return to Live Charts Tab
        btn_charts = driver.find_element(By.CSS_SELECTOR, "button[data-tab='tabCharts']")
        btn_charts.click()
        time.sleep(1)

        # 6. Condensation Scenario
        btn3 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='CONDENSATION_PD']")
        btn3.click()
        time.sleep(3)
        p3 = os.path.join(shots_dir, "03_condensation_pd_critical.png")
        driver.save_screenshot(p3)
        print("Saved:", p3)
        
        # 7. Arc Flash Scenario
        btn4 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='ARC_FLASH']")
        btn4.click()
        time.sleep(2)
        p4 = os.path.join(shots_dir, "04_arc_flash_protection.png")
        driver.save_screenshot(p4)
        print("Saved:", p4)

        # 8. Return to Normal
        btn1 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='NORMAL']")
        btn1.click()
        time.sleep(2)
        print("ALL_DOCS_SCREENSHOTS_CAPTURED_SUCCESSFULLY")

    finally:
        driver.quit()

if __name__ == "__main__":
    run_visual_tests()
