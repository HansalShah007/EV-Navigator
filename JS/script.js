const tf = dfd.tf
var next_button = document.getElementById('next-button');

var SOC_model, SOE_model;
var df_soc, df_soe, df_speed, preds_soc, preds_soe;
var refined_rows = [], speed_data = []
var driving_style = { 'Moderate': 0, 'Fast': 0 }

// Parameters from model training 
var quant_mean = 5.710360, quant_std = 7.184338

next_button.addEventListener("click", () => {

    let total_cap = document.getElementById('capacity').value
    var norm_cap = ((preds_soe[preds_soe.length - 1] * total_cap) - quant_mean) / quant_std

    let route_selected = { 'City': 0, 'Highway': 0, 'Country': 0 }
    document.getElementsByName('route').forEach((r) => {
        if (r.checked) {
            route_selected[r.value] = 1
        }
    })

    let load_selected = { 'A/C': 0, 'Heater': 0, 'None': 0 }
    document.getElementsByName('load').forEach((r) => {
        if (r.checked) {
            load_selected[r.value] = 1
        }
    })

    let tyre_selected = { 'Summer': 0, 'Winter': 0 }
    document.getElementsByName('tyre').forEach((r) => {
        if (r.checked) {
            tyre_selected[r.value] = 1
        }
    })


    // Storing all the required variables locally for importing them in another JS
    localStorage.setItem("norm_cap", norm_cap)
    localStorage.setItem("city", route_selected['City'])
    localStorage.setItem("highway", route_selected['Highway'])
    localStorage.setItem("country", route_selected["Country"])
    localStorage.setItem("a/c", load_selected["A/C"])
    localStorage.setItem("heater", load_selected['Heater'])
    localStorage.setItem("winter", tyre_selected["Winter"])
    localStorage.setItem("moderate", driving_style["Moderate"])
    localStorage.setItem("fast", driving_style["Fast"])
})


async function load_models() {
    SOC_model = await tf.loadLayersModel('./Model_SOC/JSON/model.json');
    console.log(SOC_model);
    SOE_model = await tf.loadLayersModel('./Model_SOE/JSON/model.json');
    console.log(SOE_model);
}

async function load_data() {

    const response = await fetch('test_data.csv')
    const data = await response.text();
    const rows = data.split('\n');

    rows.slice(1, rows.length - 1).forEach((r) => {
        let temp = r.split(',')
        temp = temp.map(num => parseFloat(num))
        refined_rows.push(temp.slice(0, 3))
        speed_data.push(temp.slice(3, 4))
    })
    console.log(refined_rows)

    df_soc = new dfd.DataFrame(refined_rows)
    df_speed = new dfd.DataFrame(speed_data)

    for (let i = 0; i < 3; i++) {
        df_soc[i] = df_soc[i].sub(df_soc[i].mean())
        df_soc[i] = df_soc[i].div(df_soc[i].std())
    }

    var inputs_soc = df_soc.tensor
    preds_soc = SOC_model.predict(inputs_soc).arraySync()
    console.log('Predictions for SCO: ', preds_soc)

    let i = 0;
    refined_rows.forEach((r) => {
        r.push(preds_soc[i][0])
        i = i + 1
    })

    df_soe = new dfd.DataFrame(refined_rows)
    for (i = 0; i < 3; i++) {
        df_soe[i] = df_soe[i].sub(df_soe[i].mean())
        df_soe[i] = df_soe[i].div(df_soe[i].std())
    }

    var inputs_soe = df_soe.tensor
    preds_soe = SOE_model.predict(inputs_soe).arraySync()


    if (df_speed[0].mean() >= 40 && df_speed[0].mean() <= 80) {
        driving_style['Moderate'] = 1
    }
    else if (df_speed[0].mean() > 80) {
        driving_style['Fast'] = 1
    }
}

async function initialize() {
    await load_models()
    await load_data()
}

initialize()
