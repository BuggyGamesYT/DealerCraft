# Builds DealerCraft.apk from ../web (needs JDK 17 + Android build-tools/platform 37)
set -e
export JAVA_HOME=/tmp/jdk PATH=/tmp/jdk/bin:$PATH QEMU_LD_PREFIX=/usr/x86_64-linux-gnu
BT=/tmp/bt/android-37.0; AJ=/tmp/plat/android-37.0/android.jar
export LD_LIBRARY_PATH=$BT/lib64:/usr/x86_64-linux-gnu/lib
rm -rf build assets && mkdir -p build/obj build/dex build/gen assets/www && cp ../web/* assets/www/
qemu-x86_64 $BT/aapt2 compile --dir res -o build/res.zip
qemu-x86_64 $BT/aapt2 link -o build/unsigned.apk -I $AJ --manifest AndroidManifest.xml -A assets --java build/gen build/res.zip
javac --release 17 -nowarn -cp $AJ -d build/obj $(find src build/gen -name '*.java')
java -cp $BT/lib/d8.jar com.android.tools.r8.D8 --min-api 24 --lib $AJ --output build/dex $(find build/obj -name '*.class')
(cd build/dex && zip -q ../unsigned.apk classes.dex)
qemu-x86_64 $BT/zipalign -f -p 4 build/unsigned.apk build/aligned.apk
[ -f ${KEYSTORE:-../dealercraft.keystore} ] || keytool -genkeypair -keystore ${KEYSTORE:-../dealercraft.keystore} -alias dealercraft -keyalg RSA -keysize 2048 -validity 10000 -storepass dealercraft -keypass dealercraft -dname "CN=Buggy Games YT" >/dev/null 2>&1
java -jar $BT/lib/apksigner.jar sign --ks ${KEYSTORE:-../dealercraft.keystore} --ks-pass pass:dealercraft --out DealerCraft.apk build/aligned.apk
java -jar $BT/lib/apksigner.jar verify --verbose DealerCraft.apk | head -5
ls -la DealerCraft.apk
