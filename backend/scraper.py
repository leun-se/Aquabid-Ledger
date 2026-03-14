from playwright.sync_api import sync_playwright
import json
import time
import os

def run_scraper():
    with sync_playwright() as p:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Setup
        browser = p.chromium.launch(headless=False,)
        context = browser.new_context()
        page = browser.new_page()
        scrape_timestamp = time.time()
        
        print("Navigating to New Items page...")
        page.goto("https://aquabid.com/cgi-bin/auction/auction.cgi?disp&allnew")
        
        # manual sleep
        time.sleep(2)
        
        # grab all rows
        all_rows = page.locator("tr").all()
        start_index = -1
        
        print(f"Total rows found: {len(all_rows)}. Searching for first category...")
        
        for i, row in enumerate(all_rows):
            if row.get_attribute("bgcolor") == "#C0C0C0":
                start_index = i
                print(f"Starting line found at row {i}!")
                break
        
        if start_index == -1:
            print("Could not find a category header. Is the page layout different?")
            browser.close()
            return
        
        fish_data = []
        current_category = "General"
        
        # Loop through relevant slice of the table
        for row in all_rows[start_index:]:
            bgcolor = row.get_attribute("bgcolor")
            onmouseover = row.get_attribute("onmouseover")
            
            # Case A: Hit a category row
            if bgcolor == "#C0C0C0":
                cat_link = row.locator("a").first
                if cat_link.count() > 0:
                    current_category = cat_link.inner_text().strip()
                continue

            # Case B: Hit an item row
            if onmouseover:
                # td 2 contains the link and title
                name_td = row.locator("td").nth(1)
                name_link = name_td.locator("a").first

                # Align right cells: 0 is Time left, 1 is price
                right_cells = row.locator('td[align="RIGHT"]').all()
                
                if name_link.count() > 0 and len(right_cells) >= 2:
                    title = name_link.inner_text().strip()
                    time_str = right_cells[0].inner_text().strip().lower()
                    price_str = right_cells[1].inner_text().strip()
                    
                    # Time parsing logic for accurate fish lifespan
                    seconds_left = 0
                    try:
                        if "closed" not in time_str:
                            parts = time_str.split()
                            for p in parts:
                                num = int(''.join(filter(str.isdigit, p)))
                                if 'd' in p: seconds_left += num * 86400
                                if 'h' in p: seconds_left += num * 3600
                                if 'm' in p: seconds_left += num * 60
                    except:
                        seconds_left = 3600 # fallback
                    
                    # Clean Price String
                    clean_price = ''.join(c for c in price_str.split()[0] if c.isdigit() or c == '.')
                    
                    fish_data.append({
                        "id": len(fish_data),
                        "category": current_category,
                        "title": title,
                        "price": clean_price if clean_price else "0.00",
                        "seconds_remaining": seconds_left,
                        "scraped_at": scrape_timestamp
                    })
                    
        output_path = os.path.join(current_dir, "..", "frontend", "public", "fish_data.json")
        # Save finalized data as JSON and export for Three.js frontend
        try:
            with open(output_path, "w") as f:
                json.dump(fish_data, f, indent=4)
            print(f"Sucess! Captured {len(fish_data)} auctions.")
            print(f"Data synced to: {output_path}")
        except FileNotFoundError:
            print(f"Error: The path {output_path} doesn't exist. Check folder name")
        browser.close()
        
if __name__ == "__main__":
    run_scraper()