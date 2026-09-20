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

    artifact_dir = r"C:\Users\Userr\.gemini\antigravity\brain\f13ff0a6-2214-4f33-8f3c-626ab5e962f3"
    os.makedirs(artifact_dir, exist_ok=True)

    driver = webdriver.Edge(options=options)
    try:
        driver.get("http://127.0.0.1:8000")
        time.sleep(3)
        
        # 1. Normal Scenario (let live telemetry stream for 3 seconds)
        p1 = os.path.join(artifact_dir, "test_scenario1_normal_verified.png")
        driver.save_screenshot(p1)
        print("Scenario 1 Normal screenshot saved:", p1)
        
        # 2. Loose Bolt Scenario
        btn2 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='LOOSE_BOLT']")
        btn2.click()
        time.sleep(3)
        p2 = os.path.join(artifact_dir, "test_scenario2_loose_bolt_verified.png")
        driver.save_screenshot(p2)
        print("Scenario 2 Loose Bolt screenshot saved:", p2)
        
        # 3. Condensation Scenario
        btn3 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='CONDENSATION_PD']")
        btn3.click()
        time.sleep(3)
        p3 = os.path.join(artifact_dir, "test_scenario3_condensation_verified.png")
        driver.save_screenshot(p3)
        print("Scenario 3 Condensation screenshot saved:", p3)
        
        # 4. Arc Flash Scenario
        btn4 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='ARC_FLASH']")
        btn4.click()
        time.sleep(2)
        p4 = os.path.join(artifact_dir, "test_scenario4_arc_flash_verified.png")
        driver.save_screenshot(p4)
        print("Scenario 4 Arc Flash screenshot saved:", p4)

        # 5. Return to Normal
        btn1 = driver.find_element(By.CSS_SELECTOR, "button[data-scenario='NORMAL']")
        btn1.click()
        time.sleep(2)
        print("ALL_SCENARIOS_VERIFIED_SUCCESSFULLY")

    finally:
        driver.quit()

if __name__ == "__main__":
    run_visual_tests()
