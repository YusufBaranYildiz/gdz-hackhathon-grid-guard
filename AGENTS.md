# PROJECT DIRECTIVES & HACKATHON CONSTRAINTS

This project implements the **Pano/Hücre İçi Anomali Erken Uyarı Sistemi** for **ADM & GDZ Elektrik Hackathon**.

Every action, design decision, and piece of code MUST strictly comply with:
1. **NO PUBLIC CLOUD:** All components must run On-Premise or on local Edge gateways. Never use AWS, Azure, GCP, or external cloud endpoints.
2. **NO CABLE CLUTTER:** Respect the TEDAŞ 1600 kVA AG Pano layout. Propose non-invasive, clamp-on (HFCT), optical fiber (TVOC-2), or energy-harvesting wireless sensors. Never require hazardous or messy rewiring of live busbars.
3. **MANDATORY SENSORS & REGISTERS:** Use the exact datasheets provided:
   - ENTES MPR-53CS (Modbus registers for V, I, P, Q, THD)
   - ABB TVOC-2 (Modbus registers for optical arc detection & DTC fault codes)
   - Techimp HFCT 30/50 (Partial discharge 1-60/80 MHz)
   - Temperature & Humidity (Dew point calculation using Magnus formula)
4. **PHYSICS-INFORMED ANOMALY DETECTION:** Never use simple naive static thresholds (e.g. T > 75°C). Use Joule heating ($I^2 \cdot R$), temperature residuals ($\Delta T = T_{measured} - T_{model}$), and dew point margin to detect loosening, degradation, and arcing before critical failures.
5. **WORKING END-TO-END DELIVERABLE:** Deliver a complete, interactive, high-end On-Premise SCADA/Web monitoring dashboard, Modbus simulator, early warning engine, and automated SMS/WhatsApp notification mechanism.
